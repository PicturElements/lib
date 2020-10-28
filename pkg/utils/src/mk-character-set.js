import {
	fromCodePoint,
	codePointAt
} from "./string";
import { binarySearch } from "./binary-search";
import hasOwn from "./has-own";
import parseSurrogatePair from "./parse-surrogate-pair";
import parseEscapeSequence from "./parse-escape-sequence";

const CASE_MAP = [];
const NEGATE_FUNCTIONS = {};
const CONTROL_CHARACTERS = {
	"\n": "\\n",
	"\r": "\\r",
	"\t": "\\t",
	"\f": "\\f",
	"\v": "\\v"
};
const SET_TOKENS = {
	s: "\r\n\t\f\v ",
	d: "0-9",
	w: "a-zA-Z0-9_"
};

export default function mkCharacterSet(source, insensitive = false, err = throwError) {
	source = injectSetTokens(source);

	if (typeof insensitive == "function") {
		err = insensitive;
		insensitive = false;
	}

	const negate = source[0] == "^",
		usedChars = {},
		usedFunctions = {},
		d = {
			characters: [],
			ranges: [],
			functions: [],
			parameters: []
		};

	let rangeStart = null,
		hasRangeSurrogates = false;

	const use = charOrCodePoint => {
		const cc = typeof charOrCodePoint == "string" ?
			codePointAt(charOrCodePoint, 0) :
			charOrCodePoint;

		if (hasOwn(usedChars, cc))
			return false;

		d.characters.push(cc);
		usedChars[cc] = true;
		return true;
	};

	// Parse set
	for (let i = Number(negate), l = source.length; i < l; i++) {
		const surrogate = parseSurrogatePair(source, i);
		let char = surrogate.character;
		i += surrogate.length - 1;

		if (char == "\\") {
			const nextChar = source[i + 1];

			if (hasOwn(NEGATE_FUNCTIONS, nextChar)) {
				if (hasOwn(usedFunctions, nextChar))
					continue;

				d.parameters.push(getParamName(d.functions.length));
				d.functions.push(NEGATE_FUNCTIONS[nextChar]);
				usedFunctions[nextChar] = true;
				i++;
				continue;
			}

			const parsed = parseEscapeSequence(source, i);
			char = parsed.character;
			i += parsed.length - 1;
		}

		if (rangeStart) {
			const start = rangeStart;
			rangeStart = null;

			if (start != char) {
				const from = codePointAt(start, 0),
					to = codePointAt(char, 0);

				if (from > to) {
					err(`Range [${printChar(start)}-${printChar(char)}] is out of order`);
					return null;
				}

				if (surrogate.length > 1)
					hasRangeSurrogates = true;

				d.ranges.push([from, to]);
				continue;
			}
		} else if (source[i + 1] == "-" && i < l - 2) {
			rangeStart = char;
			i++;
			continue;
		}

		if (use(char) && insensitive) {
			const uc = char.toUpperCase(),
				lc = char.toLowerCase(),
				cased = uc == char ? lc : uc;

			if (cased != char)
				use(cased);
		}
	}

	// Run through ranges and supply alternative casing
	if (insensitive) {
		for (let i = d.ranges.length - 1; i >= 0; i--) {
			const range = d.ranges[i],
				cm = getCaseMap();
			let idx = Math.max(binarySearch(cm, v => v[0] - range[0]), 0);

			for (let l = cm.length; idx < l; idx) {
				if (cm[idx][0] < range[0]) {
					idx++;
					continue;
				}

				let start = -1,
					end = -1,
					diff = -1;

				while (idx < l) {
					const item = cm[idx];

					if (item[0] > range[1])
						break;

					if (diff == -1)
						diff = item[1] - item[0];

					if (item[1] - item[0] != diff)
						break;

					end = item[1];
					if (start == -1)
						start = end;

					idx++;
				}

				if (end == -1) {
					idx++;
					continue;
				}

				if (start == end)
					use(start);
				else if (start > end)
					d.ranges.push([end, start]);
				else
					d.ranges.push([start, end]);
			}
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
				length = Math.abs(r[1] - r[0] + r2[1] - r2[0]) + 2;

			d.ranges[j - shift] = r2;

			if (extent < length) {
				r[0] = start;
				r[1] = end;
				shift++;
			}
		}

		d.ranges.length -= shift;
	}

	// Remove characters covered in ranges
	for (let i = 0; i < d.ranges.length; i++) {
		let shift = 0;
		const range = d.ranges[i];

		for (let j = 0, l = d.characters.length; j < l; j++) {
			const char = d.characters[j];

			if (char >= range[0] && char <= range[1]) {
				shift++;
				continue;
			}

			d.characters[j - shift] = char;
		}

		d.characters.length -= shift;
	}

	// Codegen
	const ccOptimize = d.ranges.length > 5 && !hasRangeSurrogates,
		charactersCode = getCharactersCode(d.characters),
		rangesCode = getRangesCode(d.ranges, ccOptimize),
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
	if (codes.length == 1)
		code = genSLReturn(codes[0], negate);
	else {
		for (let i = 0, l = codes.length; i < l; i++) {
			if (ccOptimize && rangesCode && codes[i] == rangesCode)
				code += "var cc = _v.charCodeAt(0);\n";

			if (i < l - 1)
				code += `if (${codes[i]}) return ${!negate};\n`;
			else
				code += genSLReturn(codes[i], negate);
		}
	}

	if (d.parameters.length)
		return Function(...d.parameters, "_v", code).bind(null, ...d.functions);

	return Function("_v", code);
}

function injectSetTokens(source) {
	return source.replace(/\\([sdw])/g, (_, c) => SET_TOKENS[c]);
}

function getCharactersCode(characters) {
	return characters
		.map(c => `_v == "${printChar(c)}"`)
		.join(" || ");
}

function getRangesCode(ranges, ccOptimize = false) {
	if (ranges.length == 1)
		return `_v >= "${printChar(ranges[0][0])}" && _v <= "${printChar(ranges[0][1])}"`;

	if (ccOptimize) {
		return ranges
			.map(r => `(cc >= ${r[0]} && cc <= ${r[1]})`)
			.join(" || ");
	}

	return ranges
		.map(r => `(_v >= "${printChar(r[0])}" && _v <= "${printChar(r[1])}")`)
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
	if (typeof char == "number")
		char = fromCodePoint(char);

	if (hasOwn(CONTROL_CHARACTERS, char))
		return CONTROL_CHARACTERS[char];

	if (char == "\"" || char == "\\")
		return "\\" + char;

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

function getCaseMap() {
	if (CASE_MAP.length)
		return CASE_MAP;

	const mapped = {};

	// Lowest and highest known code points
	// that have case mapping
	for (let i = 65; i < 125251; i++) {
		if (hasOwn(mapped, i)) {
			CASE_MAP.push([i, mapped[i]]);
			continue;
		}

		const char = fromCodePoint(i);
		let cased = char.toLowerCase();

		if (cased == char)
			cased = char.toUpperCase();

		if (cased == char)
			continue;

		const point = codePointAt(cased, 0);
		mapped[point] = i;
		CASE_MAP.push([i, point]);
	}

	return CASE_MAP;
}

for (const k in SET_TOKENS) {
	if (hasOwn(SET_TOKENS, k))
		NEGATE_FUNCTIONS[k.toUpperCase()] = mkCharacterSet(`^${SET_TOKENS[k]}`);
}
