import hasOwn from "./has-own";
import {
	getRegexSource,
	joinRegexFlags
} from "./regex";
import parseEscapeSequence from "./parse-escape-sequence";
import lookup from "./lookup";

const T = {
	PROGRAM: "program",
	LITERAL: "literal",
	SET: "set",
	BACKREF: "backref",
	ANY: "any",
	WORD_BOUNDARY: "word_boundary",
	NON_WORD_BOUNDARY: "non_word_boundary",
	ALTERNATION: "alternation",
	ALTERNATION_TERM: "alternation_term",
	GROUP: "group",
	NON_CAPTURING_GROUP: "non_capturing_group",
	POSITIVE_LOOKAHEAD: "positive_lookahead",
	NEGATIVE_LOOKAHEAD: "negative_lookahead",
	POSITIVE_LOOKBEHIND: "positive_lookbehind",
	NEGATIVE_LOOKBEHIND: "negative_lookbehind",
	START_ASSERTION: "start_assertion",
	END_ASSERTION: "end_assertion"
};

const SPECIAL_TOKENS = {
	s: "\\s",
	S: "\\S",
	d: "\\d",
	D: "\\D",
	w: "\\w",
	W: "\\W"
};

const GROUP_SIGNATURES = {
	"?:": T.NON_CAPTURING_GROUP,
	"?=": T.POSITIVE_LOOKAHEAD,
	"?!": T.NEGATIVE_LOOKAHEAD,
	"?<=": T.POSITIVE_LOOKBEHIND,
	"?<!": T.NEGATIVE_LOOKBEHIND
};

export default function parseRegex(source, flags = "") {
	if (source instanceof RegExp) {
		flags = joinRegexFlags(source, flags);
		source = getRegexSource(source);
	}

	if (typeof source != "string")
		source = "";
	if (typeof flags != "string")
		flags = "";

	const err = msg => {
		const e = SyntaxError(`\n\nparser@${ptr + 1}\n${msg}%end%`);
		e.stack = e.stack.split("%end%")[0];
		throw e;
	};

	const mkToken = type => ({
		type,
		start: ptr,
		end: null
	});

	const mkTokenWithData = (type, data) => {
		const token = mkToken(type);

		if (Array.isArray(data)) {
			token.children = data;
			return token;
		} else if (typeof data == "string") {
			token.value = data;
			return token;
		}

		return Object.assign(token, data);
	};

	const appendToken = token => {
		if (currentToken.end == null)
			currentToken.end = ptr - 1;

		parentToken.children.push(token);
		currentToken = token;
		return token;
	};

	const pushToken = token => {
		stack.push(token);
		parentToken.children.push(token);
		parentToken = token;
		currentToken = token;
		return token;
	};

	const popToken = _ => {
		const token = stack.pop();
		if (!token)
			err("Fell out of token stack");

		const children = token.children,
			lastChild = children && children.length && children[children.length - 1];

		if (lastChild && lastChild.end == null)
			lastChild.end = ptr - 1;

		token.end = ptr;
		parentToken = stack[stack.length - 1];
		currentToken = token;
		return token;
	};

	const consumeChar = (picky = false) => {
		const char = source[ptr];

		if (char != "\\") {
			ptr++;
			return char;
		}

		const nextChar = source[ptr + 1];

		// Special meta sequences, control characters
		if (hasOwn(SPECIAL_TOKENS, nextChar)) {
			ptr += 2;
			return SPECIAL_TOKENS[nextChar];
		}

		if (nextChar == "u" && flagLookup.has("u") && source[ptr + 2] != "{")
			err("Meaningless sequence '\\u'");

		// Remaining escape sequences
		const parsed = parseEscapeSequence(source, ptr, {
			codepoint: flagLookup.has("u")
		});
		ptr += parsed.length;

		if (parsed.error)
			err(parsed.error);

		if (!picky || (parsed.type != "none" && parsed.type != "raw"))
			return parsed.character;

		return "\\" + nextChar;
	};

	const consumeNextLiteralChar = _ => {
		if (currentToken.type == T.LITERAL && !currentToken.quantify)
			currentToken.value += consumeChar();
		else {
			const literal = appendToken(mkToken(T.LITERAL));
			literal.value = consumeChar();
		}
	};

	const addQuantifier = (min, max, p = ptr) => {
		if (!isQuantifiable(currentToken))
			err("Token is not quantifiable");

		if (currentToken.quantify)
			err("Nothing to repeat");

		if (currentToken.type == T.LITERAL && currentToken.value.length > 1) {
			const val = currentToken.value,
				char = val[val.length - 1];

			currentToken.value = val.substring(0, val.length - 1);
			ptr--;
			appendToken(mkTokenWithData(T.LITERAL, char));
			ptr++;
		}

		const lazy = source[p + 1] == "?";

		currentToken.end = ptr;
		currentToken.quantify = {
			min,
			max,
			lazy
		};

		if (lazy)
			ptr++;
	};

	const len = source.length,
		groups = [],
		flagLookup = lookup(flags, "");
	let ptr = 0,
		program = mkTokenWithData(T.PROGRAM, {
			children: [],
			source,
			flags,
			flagLookup
		}),
		parentToken = program,
		currentToken = program,
		stack = [program];

	while (ptr < len) {
		const char = source[ptr];

		// Consume set contents
		if (parentToken.type == T.SET && char != "]") {
			parentToken.value += consumeChar(true);
			continue;
		}

		switch (char) {
			case "\\":
				consumeNextLiteralChar();
				break;

			case "(": {
				let groupSignature = source.substring(ptr + 1, ptr + 3),
					tokenType;

				if (hasOwn(GROUP_SIGNATURES, groupSignature))
					tokenType = GROUP_SIGNATURES[groupSignature];
				
				if (!tokenType) {
					groupSignature = source.substring(ptr + 1, ptr + 4);
					if (hasOwn(GROUP_SIGNATURES, groupSignature))
						tokenType = GROUP_SIGNATURES[groupSignature];
				}

				if (!tokenType) {
					tokenType = T.GROUP;
					groupSignature = "";
				}

				const group = pushToken(mkTokenWithData(tokenType, []));
				group.isGroup = true;
				if (tokenType != T.NON_CAPTURING_GROUP)
					groups.push(group);
				ptr += groupSignature.length + 1;
				break;
			}

			case ")": {
				if (parentToken.type == T.ALTERNATION_TERM) {
					popToken();
					popToken();
				}

				const token = popToken();
				if (!token.isGroup)
					err("Unmatched parenthesis");

				ptr++;
				break;
			}

			case "[":
				pushToken(mkTokenWithData(T.SET, ""));
				ptr++;
				break;

			case "]":
				if (currentToken.type == T.SET) {
					popToken();
					ptr++;
				} else
					consumeNextLiteralChar();
				break;

			case "|":
				if (parentToken.type != T.ALTERNATION_TERM) {
					const children = parentToken.children,
						start = parentToken.start;
					parentToken.children = [];
					pushToken(mkTokenWithData(T.ALTERNATION, []));
					pushToken(mkTokenWithData(T.ALTERNATION_TERM, {
						children,
						start
					}));
					popToken();
					pushToken(mkTokenWithData(T.ALTERNATION_TERM, []));
				} else {
					popToken();
					pushToken(mkTokenWithData(T.ALTERNATION_TERM, []));
				}
				ptr++;
				break;

			// Quantifiers
			case "+":
				addQuantifier(1, Infinity);
				ptr++;
				break;

			case "*":
				addQuantifier(0, Infinity);
				ptr++;
				break;

			case "?":
				addQuantifier(0, 1);
				ptr++;
				break;

			case "{": {
				let min = 0,
					max = 0,
					dec = 0,
					count = 0,
					consumed = 0,
					visited = 0;

				for (let i = ptr + 1; i < len; i++) {
					const c = source[i],
						cc = c.charCodeAt(0) - 48;

					visited++;

					if (c == "}") {
						if (!count && !consumed)
							break;

						if (!count) {
							min = dec;
							max = dec;
						} else if (dec)
							max = dec;

						if (min > max)
							err("Quantifier range out of order");

						const diff = i - ptr + 1;
						addQuantifier(min, max, i);
						ptr += diff;
						visited = 0;
						break;
					}

					if (c == "," && !count) {
						if (!consumed)
							break;

						min = dec;
						max = Infinity;
						dec = 0;
						consumed = 0;
						count++;
						continue;
					}
						
					if (cc < 0 || cc > 9)
						break;

					dec = dec * 10 + cc;
					consumed++;
				}

				if (flagLookup.has("u"))
					err("Unescaped '{' not valid with unicode flag enabled unless in valid range quantifier");

				for (let i = 0; i < visited; i++)
					consumeNextLiteralChar();

				break;
			}

			// Assertions, special characters
			case "^":
				appendToken(mkToken(T.START_ASSERTION));
				ptr++;
				break;

			case "$":
				appendToken(mkToken(T.END_ASSERTION));
				ptr++;
				break;

			case ".":
				appendToken(mkToken(T.ANY));
				ptr++;
				break;

			default: {
				if (char == "\\") {
					const nextChar = source[ptr + 1];

					// Word boundaries
					if (nextChar == "b" || nextChar == "B") {
						appendToken(
							mkToken(nextChar == "b" ? T.WORD_BOUNDARY : T.NON_WORD_BOUNDARY)
						);
						ptr += 2;
						break;
					}

					// Backrefs
					let refId = 0,
						refIdLen = 0;
					for (let i = 0; i < 3 && ptr + i + 1 < len; i++) {
						const c = source[ptr + i + 1],
							cc = c.charCodeAt(0) - 48;

						if (cc < 0 || cc > 9)
							break;
						
						refId = refId * 10 + cc;
						refIdLen++;
					}

					if (refId && refId <= groups.length) {
						appendToken(
							mkTokenWithData(T.BACKREF, {
								id: refId,
								group: groups[refId - 1]
							})
						);
						ptr += refIdLen + 1;
						break;
					}
				}

				consumeNextLiteralChar();
			}
		}
	}

	ptr--;

	while (stack.length) {
		const token = popToken();

		switch (token.type) {
			case T.GROUP:
				err("Unterminated group");
				break;

			case T.NON_CAPTURING_GROUP:
				err("Unterminated non-capturing group");
				break;

			case T.POSITIVE_LOOKAHEAD:
				err("Unterminated positive lookahead");
				break;

			case T.NEGATIVE_LOOKAHEAD:
				err("Unterminated negative lookahead");
				break;

			case T.POSITIVE_LOOKBEHIND:
				err("Unterminated positive lookbehind");
				break;

			case T.NEGATIVE_LOOKBEHIND:
				err("Unterminated negative lookbehind");
				break;

			case T.SET:
				err("Unterminated character set");
				break;
		}
	}

	return program;
}

parseRegex.TOKENS = T;

function isQuantifiable(token) {
	switch (token.type) {
		case T.LITERAL:
		case T.SET:
		case T.BACKREF:
		case T.GROUP:
		case T.NON_CAPTURING_GROUP:
		case T.POSITIVE_LOOKAHEAD:
		case T.NEGATIVE_LOOKAHEAD:
		case T.POSITIVE_LOOKBEHIND:
		case T.NEGATIVE_LOOKBEHIND:
		case T.ANY:
			return true;
	}

	return false;
}
