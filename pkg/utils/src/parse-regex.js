import {
	composeOptionsTemplates,
	createOptionsObject
} from "./internal/options";
import {
	stickyExec,
	getRegexSource,
	joinRegexFlags,
	compileStickyCompatibleRegex
} from "./regex";
import {
	isObject,
	isAlpha,
	isAlphanumeric
} from "./is";
import { assign } from "./object";
import parseEscapeSequence from "./parse-escape-sequence";
import lookup from "./lookup";
import hasOwn from "./has-own";

const TOKEN_SYNTAX_REGEX = /([A-Z_]+)(?:\/(\w+))?\s*(?:'([^']+)')?\s*(?:([\w\s,]+))?/,
	TOKEN_DATA = {},
	T = {};

const TOKEN_RAW_DATA = [
	"PROGRAM",
	"LITERAL/q",
	"SET/q 'character set'",
	"BACKREF/q",
	"NAMED_BACKREF/q",
	"ANY/q 'any character'",
	"WORD_BOUNDARY",
	"NON_WORD_BOUNDARY 'non-word boundary'",
	"UNICODE_PROPERTY/q",
	"NEGATED_UNICODE_PROPERTY/q",
	"ALTERNATION",
	"ALTERNATION_TERM",
	"CAPTURING_GROUP/q",
	"NAMED_CAPTURING_GROUP/q",
	"NON_CAPTURING_GROUP/q 'non-capturing group'",
	"POSITIVE_LOOKAHEAD",
	"NEGATIVE_LOOKAHEAD",
	"POSITIVE_LOOKBEHIND",
	"NEGATIVE_LOOKBEHIND",
	"START_ASSERTION",
	"END_ASSERTION",
	"CUSTOM_RULE"
];

TOKEN_RAW_DATA.forEach(sx => {
	const [
		_,
		type,
		flags = "",
		description = "",
		flavors = "any"
	] = TOKEN_SYNTAX_REGEX.exec(sx);

	const data = {
		enum: type,
		description: description || type.toLowerCase().replace(/_/g, " "),
		quantifiable: flags.indexOf("q") > -1,
		flavors: flavors.trim().split(/\s*,\s*/),
		flavorsMap: {}
	};

	data.flavors.forEach(fl => data.flavorsMap[fl] = true);
	TOKEN_DATA[type] = data;
	T[type] = type;
});

const SPECIAL_TOKENS = {
	s: "\\s",
	S: "\\S",
	d: "\\d",
	D: "\\D",
	w: "\\w",
	W: "\\W"
};

// Escapable characters in ECMA regexes, within character sets,
// with the unicode flag enabled
const ESCAPABLE_CHARACTERS = {
	b: "backspace",
	f: "form-feed",
	n: "newline",
	"0": "null",
	r: "carriage return",
	t: "tab",
	v: "vertical tab",

	d: "digit",
	D: "non-digit",
	w: "word",
	W: "non-word",
	s: "whitespace",
	S: "non-whitespace",

	".": "any",
	"/": "slash",
	"\\": "escape",

	"+": "kleene plus",
	"*": "kleene star",
	"^": "start assertion",
	"$": "end assertion",
	"|": "alternation",
	"{": "opening brace",
	"}": "closing brace",
	"(": "opening parenthesis",
	")": "closing parenthesis",
	"[": "opening square bracket",
	"]": "closing square bracket"
};

const GROUP_SIGNATURES = {
	"?<": T.NAMED_CAPTURING_GROUP,
	"?:": T.NON_CAPTURING_GROUP,
	"?=": T.POSITIVE_LOOKAHEAD,
	"?!": T.NEGATIVE_LOOKAHEAD,
	"?<=": T.POSITIVE_LOOKBEHIND,
	"?<!": T.NEGATIVE_LOOKBEHIND
};

const FLAVORS = {
	ECMA: "ECMA",
	PCRE: "PCRE"
};

const OPTIONS_TEMPLATES = composeOptionsTemplates({
	ecma: {
		flavor: FLAVORS.ECMA
	},
	pcre: {
		flavor: FLAVORS.PCRE
	}
});

export default function parseRegex(source, flags = "", options = null) {
	if (source instanceof RegExp) {
		flags = joinRegexFlags(source, flags);
		source = getRegexSource(source);
	}

	if (typeof source != "string")
		source = "";
	if (typeof flags != "string")
		flags = "";

	options = createOptionsObject(options, OPTIONS_TEMPLATES);

	const err = (msg, col = ptr) => {
		const e = SyntaxError(`\n\nparser@${col + 1}\n${msg}%end%`);
		e.stack = e.stack.split("%end%")[0];
		throw e;
	};

	const mkRuntime = _ => ({
		ptr,
		source,
		flavor,
		stack,
		parentToken,
		currentToken,
		flagLookup,
		ex: null,
		definition: null
	});

	const mkToken = type => ({
		type,
		start: ptr,
		end: null,
		tokenData: TOKEN_DATA[type]
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

		return assign(token, data);
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
			ptr += SPECIAL_TOKENS[nextChar].length;
			return SPECIAL_TOKENS[nextChar];
		}

		if (flagLookup.has("u")) {
			if (nextChar == "u" || nextChar == "p") {
				if (source[ptr + 2] != "{")
					err(`Meaningless sequence '\\${nextChar}'`);
			} if (flavor == FLAVORS.ECMA && !hasOwn(ESCAPABLE_CHARACTERS, nextChar))
				err(`Unnecessary escape sequence '\\${nextChar}' in ECMA2015+ regex`);
		}

		// Remaining escape sequences
		const parsed = parseEscapeSequence(source, ptr, {
			codepoint: flagLookup.has("u")
		});

		if (parsed.error)
			err(parsed.error);
		
		ptr += parsed.length;

		if (!picky || (parsed.type != "none" && parsed.type != "raw"))
			return parsed.character;

		return "\\" + nextChar;
	};

	const consumeNextLiteralChar = _ => {
		if (currentToken.type == T.LITERAL && !currentToken.quantify) {
			currentToken.value += consumeChar();
			currentToken.end = currentToken.start + currentToken.value.length - 1;
		} else {
			const literal = appendToken(mkToken(T.LITERAL));
			literal.value = consumeChar();
			literal.end = literal.start + literal.value.length - 1;
		}
	};

	const consumeRangedQuantifier = _ => {
		let min = 0,
			max = 0,
			dec = 0,
			count = 0,
			consumed = 0,
			visited = 0;

		if (ptr + 1 == len)
			visited = 1;

		for (let i = ptr + 1; i < len; i++) {
			const c = source[i],
				digit = c.charCodeAt(0) - 48;

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

				const newPtr = addQuantifier(min, max, i);
				ptr = newPtr + i - ptr + 1;
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

			if (digit < 0 || digit > 9)
				break;

			dec = dec * 10 + digit;
			consumed++;
		}

		if (visited && flagLookup.has("u"))
			err("Unescaped '{' not valid with unicode flag enabled unless in valid range quantifier");

		for (let i = 0; i < visited; i++)
			consumeNextLiteralChar();
	};

	const addQuantifier = (min, max, p = ptr) => {
		if (!currentToken.tokenData.quantifiable)
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

		return lazy ?
			ptr + 1 :
			ptr;
	};

	const peek = (check, exitChar, offset = 0) => {
		const result = {
			buffer: "",
			success: false
		};

		for (let i = ptr + offset; i < len; i++) {
			const c = source[i];

			if (c == exitChar) {
				result.success = true;
				break;
			}

			result.buffer += c;
			
			if (!check(c))
				break;
		}

		return result;
	};

	const supportsFlavor = tokenOrTokenData => {
		const tokenData = (tokenOrTokenData && tokenOrTokenData.tokenData) || tokenOrTokenData;

		if (!tokenData || !tokenData.flavorsMap)
			return false;

		return hasOwn(tokenData.flavorsMap, "any") || hasOwn(tokenData.flavorsMap, flavor);
	};

	const applyCustomRules = _ => {
		let rule = null,
			definition = null;

		if (!customRules)
			return null;

		if (typeof customRules == "function") {
			const rt = mkRuntime();
			rt.definition = customRules;
			rule = customRules();
		} else {
			let rt = null;

			for (let i = 0, l = customRules.length; i < l; i++) {
				const cr = customRules[i];

				definition = cr;

				if (!supportsFlavor(cr.tokenData))
					continue;

				if (typeof cr.match == "function") {
					rt = rt || mkRuntime();
					rt.ex = null;
					rt.definition = cr;
					rule = cr.match(rt);
				} else {
					const ex = stickyExec(cr.match, source, ptr);
					if (!ex)
						continue;

					if (cr.process) {
						rt = rt || mkRuntime();
						rt.ex = ex;
						rt.definition = cr;
						rule = cr.process(rt);
					} else {
						rule = {
							match: ex[0],
							length: ex[0].length
						};
					}
				}

				if (typeof rule == "string" || typeof rule == "number" || isObject(rule))
					break;
				
				rule = null;
			}
		}

		if (typeof rule == "string") {
			rule = {
				value: rule,
				length: rule.length
			};
		} else if (typeof rule == "number") {
			rule = {
				value: source.substring(ptr, ptr + rule),
				length: rule
			};
		}

		if (!isObject(rule))
			return null;

		if (typeof rule.length != "number") {
			if (definition)
				err(`Unbounded match found for rule '${definition.name}'`);
			err("Unbounded match found for rule");
		}

		if (!rule.length) {
			if (definition)
				err(`Zero-length match found for rule '${definition.name}'`);
			err("Zero-length match found for rule");
		}

		const token = mkTokenWithData(T.CUSTOM_RULE, {
			rule,
			value: hasOwn(rule, "value") ?
				rule.value :
				rule,
			tokenData: (definition && definition.tokenData) || TOKEN_DATA.CUSTOM_RULE
		});

		ptr += rule.length;
		appendToken(token);

		return token;
	};

	const mkCustomRuleTokenData = (data = {}) => {
		const d = {
			enum: T.CUSTOM_RULE,
			description: data.description || `custom rule: ${data.name}`,
			quantifiable: hasOwn(data, "quantifiable") ?
				Boolean(data.quantifiable) :
				TOKEN_DATA.CUSTOM_RULE.quantifiable,
			flavors: data.flavors || TOKEN_DATA.CUSTOM_RULE.flavors,
			flavorsMap: {}
		};

		if (typeof d.flavors == "string")
			d.flavors = d.flavors.trim().split(/\s*,\s*/);

		for (let i = 0, l = d.flavors.length; i < l; i++)
			d.flavorsMap[d.flavors[i]] = true;

		return d;
	};

	const len = source.length,
		flavor = options.flavor || FLAVORS.ECMA,
		groups = [],
		namedGroups = {},
		backrefs = [],
		flagLookup = lookup(flags, "");
	let ptr = 0,
		program = mkTokenWithData(T.PROGRAM, {
			children: [],
			source,
			flags,
			flagLookup,
			groups,
			namedGroups
		}),
		parentToken = program,
		currentToken = program,
		stack = [program],
		customRules = options.rules || options.rule;

	if (customRules && typeof customRules != "function" && !Array.isArray(customRules))
		customRules = [customRules];

	if (Array.isArray(customRules)) {
		const tmpRules = [];

		for (let i = 0, l = customRules.length; i < l; i++) {
			const cr = customRules[i];

			if (!isObject(cr))
				throw new TypeError("Cannot Non-functional custom rule definitions must be object");
			if (typeof cr.match != "function" && !(cr.match instanceof RegExp))
				throw new TypeError("Rule definition must have functional or regex 'match' field");
			if (typeof cr.name != "string")
				throw new TypeError("Rule definition must have a 'name' field");

			const definition = {
				name: cr.name,
				match: cr.match instanceof RegExp ?
					compileStickyCompatibleRegex(cr.match) :
					cr.match,
				process: typeof cr.process == "function" ?
					cr.process :
					null,
				tokenData: mkCustomRuleTokenData(cr)
			};

			tmpRules.push(definition);
		}

		customRules = tmpRules;
	}

	while (ptr < len) {
		const char = source[ptr];

		// Consume set contents
		if (parentToken.type == T.SET && char != "]") {
			parentToken.value += consumeChar(true);
			continue;
		}

		switch (char) {
			case "\\": {
				const nextChar = source[ptr + 1];

				// Word boundaries
				if (nextChar == "b" || nextChar == "B") {
					const token = mkToken(
						nextChar == "b" ?
							T.WORD_BOUNDARY :
							T.NON_WORD_BOUNDARY
					);

					appendToken(token);
					ptr += 2;
					break;
				}

				// Unicode properties
				if (flagLookup.has("u") && (nextChar == "p" || nextChar == "P") && source[ptr + 2] == "{") {
					const peeked = peek(c => c == "_" || c == "=" || isAlpha(c), "}", 3);

					if (!peeked.buffer || !peeked.success)
						err(`Invalid group reference '${peeked.buffer}'`);

					appendToken(mkTokenWithData(
						nextChar == "p" ? T.UNICODE_PROPERTY : T.NEGATED_UNICODE_PROPERTY,
						peeked.buffer
					));

					ptr += (peeked.buffer.length + 4);
					break;
				}

				// Backrefs
				let refId = 0,
					refIdLen = 0,
					tokenType = null;
				
				if (nextChar == "k" && source[ptr + 2] == "<") {
					tokenType = T.NAMED_BACKREF;

					const peeked = peek(isAlphanumeric, ">", 3);

					if (!peeked.buffer || !peeked.success)
						err(`Invalid group reference '${peeked.buffer}'`);

					refId = peeked.buffer;
					refIdLen = refId.length + 3;
				} else {
					tokenType = T.BACKREF;

					for (let i = ptr + 1; i < len; i++) {
						const digit = source.charCodeAt(i) - 48;

						if (digit < 0 || digit > 9)
							break;

						refId = refId * 10 + digit;
						refIdLen++;
					}
				}

				if (refId) {
					const token = appendToken(
						mkTokenWithData(tokenType, {
							id: refId,
							group: null,
							end: ptr + refIdLen
						})
					);

					backrefs.push({
						token,
						id: refId,
						idx: parentToken.children.length - 1,
						parent: parentToken
					});

					ptr += refIdLen + 1;
					break;
				}
				
				consumeNextLiteralChar();
				break;
			}

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
					tokenType = T.CAPTURING_GROUP;
					groupSignature = "";
				}

				const group = pushToken(mkTokenWithData(tokenType, []));
				group.isGroup = true;
				if (tokenType == T.CAPTURING_GROUP || tokenType == T.NAMED_CAPTURING_GROUP)
					groups.push(group);
				ptr += groupSignature.length + 1;

				if (tokenType == T.NAMED_CAPTURING_GROUP) {
					const peeked = peek(isAlphanumeric, ">");

					if (!peeked.success || !peeked.buffer)
						err("Invalid capturing group name");
					if (hasOwn(namedGroups, peeked.buffer))
						err(`Duplicate capturing group name '${peeked.buffer}'`);

					group.name = peeked.buffer;
					namedGroups[peeked.buffer] = group;
					ptr += (peeked.buffer.length + 1);
				}

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
				ptr = addQuantifier(1, Infinity) + 1;
				break;

			case "*":
				ptr = addQuantifier(0, Infinity) + 1;
				break;

			case "?":
				ptr = addQuantifier(0, 1) + 1;
				break;

			case "{":
				consumeRangedQuantifier();
				break;

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
				if (!applyCustomRules())
					consumeNextLiteralChar();
			}
		}
	}

	ptr--;

	// Resolve backrefs
	for (let i = backrefs.length - 1; i >= 0; i--) {
		const backref = backrefs[i];

		if (typeof backref.id == "string") {
			if (!hasOwn(namedGroups, backref.id))
				err(`Invalid named reference '${backref.id}'`, backref.token.start);

			backref.token.group = namedGroups[backref.id];
		} else if (backref.id <= groups.length)
			backref.token.group = groups[backref.id - 1];
		else {
			const parsed = parseEscapeSequence(`\\${backref.id}`, null, {
				codepoint: flagLookup.has("u")
			});
	
			if (parsed.error)
				err(parsed.error, backref.token.start);

			const str = parsed.character + String(backref.id).slice(parsed.length - 1),
				tokens = backref.parent.children,
				prevToken = tokens[backref.idx - 1],
				nextToken = tokens[backref.idx + 1],
				prevIsLiteral = Boolean(prevToken) && prevToken.type == T.LITERAL,
				nextIsLiteral = Boolean(nextToken) && nextToken.type == T.LITERAL;

			if (prevIsLiteral && nextIsLiteral) {
				prevToken.value += str + nextToken.value;
				prevToken.end = nextToken.end;
				tokens.splice(backref.idx, 2);
			} else if (prevIsLiteral) {
				prevToken.value += str;
				nextToken.end = backref.token.end;
				tokens.splice(backref.idx, 1);
			} else if (nextIsLiteral) {
				nextToken.value = str + nextToken.value;
				nextToken.start = backref.token.start;
				tokens.splice(backref.idx, 1);
			} else {
				const literal = mkToken(T.LITERAL);
				literal.value = str;
				literal.start = backref.token.start;
				literal.end = backref.token.end;
				tokens[backref.idx] = literal;
			}
		}
	}

	while (stack.length) {
		const token = popToken();

		switch (token.type) {
			case T.CAPTURING_GROUP:
			case T.NAMED_CAPTURING_GROUP:
			case T.NON_CAPTURING_GROUP:
			case T.POSITIVE_LOOKAHEAD:
			case T.NEGATIVE_LOOKAHEAD:
			case T.POSITIVE_LOOKBEHIND:
			case T.NEGATIVE_LOOKBEHIND:
			case T.SET:
				err(`Unterminated ${TOKEN_DATA[token.type].description}`);
				break;
		}
	}

	return program;
}

parseRegex.TOKEN_DATA = TOKEN_DATA;
parseRegex.TOKENS = T;
parseRegex.ESCAPABLE_CHARACTERS = ESCAPABLE_CHARACTERS;
parseRegex.GROUP_SIGNATURES = GROUP_SIGNATURES;
parseRegex.FLAVORS = FLAVORS;
