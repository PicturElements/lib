import hasOwn from "./has-own";
import { getRegexSource } from "./regex";
import parseEscapeSequence from "./parse-escape-sequence";

const T = {
	PROGRAM: "program",
	LITERAL: "literal",
	SET: "set",
	BACKREF: "backref",
	WORD_BOUNDARY: "word_boundary",
	NON_WORD_BOUNDARY: "non_word_boundary",
	ALTERNATION: "alternation",
	ALTERANATION_TERM: "alternation_term",
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

export default function parseRegex(source) {
	source = source instanceof RegExp ?
		getRegexSource(source) :
		source;

	const mkToken = (type, data = null) => {
		const base = {
			type,
			start: ptr,
			end: null
		};

		if (Array.isArray(data)) {
			base.children = data;
			data = null;
		} else if (typeof data == "string") {
			base.value = data;
			data = null;
		}

		return Object.assign(base, data);
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
			throw new Error("Fell out of token stack");

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

		const parsed = parseEscapeSequence(source, ptr);
		ptr += parsed.length;

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

	const addQuantifier = (min, max, lazy) => {
		if (!isQuantifiable(currentToken))
			throw new Error("Token is not quantifiable");

		if (currentToken.quantify)
			throw new Error("Nothing to repeat");

		if (currentToken.type == T.LITERAL && currentToken.value.length > 1) {
			const val = currentToken.value,
				char = val[val.length - 1];

			currentToken.value = val.substring(0, val.length - 1);
			ptr--;
			appendToken(mkToken(T.LITERAL, char));
			ptr++;
		}

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
		groups = [];
	let ptr = 0,
		program = mkToken(T.PROGRAM, []),
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

				const group = pushToken(mkToken(tokenType, []));
				if (tokenType != T.NON_CAPTURING_GROUP)
					groups.push(group);
				ptr += groupSignature.length + 1;
				break;
			}

			case ")":
				if (parentToken.type == T.ALTERANATION_TERM) {
					popToken();
					popToken();
				}

				popToken();
				ptr++;
				break;

			case "[":
				pushToken(mkToken(T.SET, ""));
				ptr++;
				break;

			case "]":
				popToken();
				ptr++;
				break;

			case "|":
				if (parentToken.type != T.ALTERANATION_TERM) {
					const children = parentToken.children,
						start = parentToken.start;
					parentToken.children = [];
					pushToken(mkToken(T.ALTERNATION, []));
					pushToken(mkToken(T.ALTERANATION_TERM, {
						children,
						start
					}));
					popToken();
					pushToken(mkToken(T.ALTERANATION_TERM, []));
				} else {
					popToken();
					pushToken(mkToken(T.ALTERANATION_TERM, []));
				}
				ptr++;
				break;

			// Quantifiers
			case "+":
				addQuantifier(1, Infinity, source[ptr + 1] == "?");
				ptr++;
				break;

			case "*":
				addQuantifier(0, Infinity, source[ptr + 1] == "?");
				ptr++;
				break;

			case "?":
				addQuantifier(0, 1, source[ptr + 1] == "?");
				ptr++;
				break;

			case "{": {
				let min = 0,
					max = 0,
					dec = 0,
					count = 0;

				for (let i = ptr + 1; i < len; i++) {
					const c = source[i],
						cc = c.charCodeAt(0) - 48;

					if (c == "}") {
						if (!count) {
							min = dec;
							max = dec;
						} else if (dec)
							max = dec;

						if (min > max)
							throw new Error("Quantifier range out of order");

						const diff = i - ptr + 1;
						addQuantifier(min, max, source[i + 1] == "?");
						ptr += diff;
						break;
					}

					if (c == "," && !count) {
						min = dec;
						max = Infinity;
						dec = 0;
						count++;
						continue;
					}
						
					if (cc < 0 || cc > 9) {
						consumeNextLiteralChar();
						break;
					}

					dec = dec * 10 + cc;
				}
				break;
			}

			// Assertions
			case "^":
				appendToken(mkToken(T.START_ASSERTION));
				ptr++;
				break;

			case "$":
				appendToken(mkToken(T.END_ASSERTION));
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
							mkToken(T.BACKREF, {
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

	while (stack.length)
		popToken();

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
			return true;
	}

	return false;
}
