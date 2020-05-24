import hasOwn from "./has-own";
import parseEscapeSequence from "./parse-escape-sequence";

const SET_TOKENS = {
	s: "\r\n\t\f\v ",
	d: "0-9",
	w: "a-zA-Z0-9_"
};

const NEGATE_FUNCTIONS = {};

const CONTROL_CHARACTERS = {
	"\n": "\\n",
	"\r": "\\r",
	"\t": "\\t",
	"\f": "\\f",
	"\v": "\\v"
};

export default function mkCharacterSet(set, error = throwError) {
	set = injectSetTokens(set);

	const negate = set[0] == "^",
		usedChars = {},
		usedFunctions = {},
		d = {
			characters: [],
			ranges: [],
			functions: [],
			parameters: []
		};

	let rangeStart = null;

	// Parse set
	for (let i = Number(negate), l = set.length; i < l; i++) {
		let char = set[i];

		if (char == "\\") {
			const nextChar = set[i + 1];

			if (hasOwn(NEGATE_FUNCTIONS, nextChar)) {
				if (hasOwn(usedFunctions, nextChar))
					continue;

				d.parameters.push(getParamName(d.functions.length));
				d.functions.push(NEGATE_FUNCTIONS[nextChar]);
				usedFunctions[nextChar] = true;
				i++;
				continue;
			}

			const parsed = parseEscapeSequence(set, i);
			char = parsed.character;
			i += parsed.length - 1;
		}

		if (rangeStart) {
			const start = rangeStart;
			rangeStart = null;

			if (start != char) {
				const from = start.charCodeAt(0),
					to = char.charCodeAt(0);

				if (from > to) {
					error(`Range [${printChar(start)}-${printChar(char)}] is out of order`);
					return null;
				}

				d.ranges.push([from, to]);
				continue;
			}
		} else if (set[i + 1] == "-" && i < l - 2) {
			rangeStart = char;
			i++;
			continue;
		}

		if (!hasOwn(usedChars, char)) {
			d.characters.push(char);
			usedChars[char] = true;
		}
	}

	// Collapse overlapping ranges
	for (let i = 0; i < d.ranges.length; i++) {
		let shift = 0;

		for (let j = i + 1, l = d.ranges.length; j < l; j++) {
			const r = d.ranges[i],
				r2 = d.ranges[j],
				start = Math.min(r[0], r2[0]),
				end = Math.max(r[1], r2[1]),
				extent = end - start,
				length =  Math.abs(r[1] - r[0] + r2[1] - r2[0]) + 2;

			d.ranges[j - shift] = r2;

			if (extent < length) {
				r[0] = start;
				r[1] = end;
				shift++;
			}
		}

		d.ranges.length -= shift;
	}

	// Codegen
	const charactersCode = getCharactersCode(d.characters),
		rangesCode = getRangesCode(d.ranges),
		functionsCode = getFunctionsCode(d.parameters),
		codes = [];
	let code = "";

	if (charactersCode)
		codes.push(charactersCode);
	if (rangesCode)
		codes.push(rangesCode);
	if (functionsCode)
		codes.push(functionsCode);

	if (!codes.length)
		return _ => negate;

	// One-liner
	if (codes.length == 1) {
		if (rangesCode)
			code += "var cc = _v.charCodeAt(0);\n";

		code += genSLReturn(codes[0], negate);
	} else {
		for (let i = 0, l = codes.length; i < l; i++) {
			if (rangesCode && codes[i] == rangesCode)
				code += "var cc = _v.charCodeAt(0);\n";

			if (i < l - 1)
				code += `if (${codes[i]}) return ${!negate};\n`;
			else
				code += genSLReturn(codes[i], negate);
		}
	}

	return Function(...d.parameters, "_v", code).bind(null, ...d.functions);
}

function injectSetTokens(set) {
	return set.replace(/\\([sdw])/g, (_, c) => SET_TOKENS[c]);
}

function getCharactersCode(characters) {
	return characters
		.map(c => `_v == "${printChar(c)}"`)
		.join(" || ");
}

function getRangesCode(ranges) {
	if (ranges.length == 1)
		return `cc >= ${ranges[0][0]} && cc <= ${ranges[0][1]}`;

	return ranges
		.map(r => `(cc >= ${r[0]} && cc <= ${r[1]})`)
		.join(" || ");
}

function getFunctionsCode(parameters) {
	return parameters
		.map(p => `${p}(_v)`)
		.join(" || ");
}

function genSLReturn(code, negate) {
	return `return ${negate ? "!(" : ""}${code}${negate ? ")" : ""};`;
}

function printChar(char) {
	if (hasOwn(CONTROL_CHARACTERS, char))
		return CONTROL_CHARACTERS[char];

	return char;
}

function getParamName(idx) {
	let name = "";

	while (true) {
		name = String.fromCharCode(97 + idx % 26) + name;

		if (idx < 26)
			break;

		idx = Math.floor(idx / 26) - 1;
	}

	return name;
}

function throwError(msg) {
	throw new SyntaxError(msg);
}

for (const k in SET_TOKENS) {
	if (hasOwn(SET_TOKENS, k))
		NEGATE_FUNCTIONS[k.toUpperCase()] = mkCharacterSet(`^${SET_TOKENS[k]}`);
}
