import hasOwn from "./has-own";
import { fromCodePoint } from "./str";
import { isHexDigit } from "./is";

const KEYWORD_ESCAPES = {
	n: "\n",
	r: "\r",
	t: "\t",
	f: "\f",
	v: "\v"
};

export default function parseEscapeSequence(source, offset = 0, options = {}) {
	if (typeof offset != "number") {
		options = offset;
		offset = 0;
	}

	if (!options || typeof options != "object")
		options = {};

	const len = source.length;
	let length = 0;

	if (source[offset] != "\\" || source.length < offset + 1) {
		return {
			character: "",
			length,
			type: "none"
		};
	}

	length++;

	if (source.length < offset + 2) {
		return {
			character: "\\",
			length,
			type: "raw"
		};
	}

	const nextChar = source[offset + 1];

	if (options.keyword !== false && hasOwn(KEYWORD_ESCAPES, nextChar)) {
		return {
			character: KEYWORD_ESCAPES[nextChar],
			length: length + 1,
			type: "keyword"
		};
	}

	// Unicode code point
	if (options.codepoint !== false && nextChar == "u" && source[offset + 2] == "{") {
		let sequence = "";

		for (let i = offset + 3; i < len; i++) {
			if (source[i] == "}") {
				if (!sequence)
					break;

				return {
					character: fromCodePoint(parseInt(sequence, 16)),
					length: sequence.length + 4,
					type: "codepoint"
				};
			}

			if (!isHexDigit(source[i]))
				break;

			sequence += source[i];
		}

		return {
			character: "",
			length: 0,
			type: "codepoint",
			error: "Invalid Unicode escape sequence"
		};
	}

	// Hex string
	if (options.hexadecimal !== false && (nextChar == "u" || nextChar == "x")) {
		const targetLen = nextChar == "u" ? 4 : 2,
			sequence = source.substring(offset + length + 1, offset + length + targetLen + 1),
			parsed = Number("0x" + sequence);

		if (sequence.length != targetLen || isNaN(parsed)) {
			return {
				character: nextChar,
				length: length + 1,
				type: "raw"
			};
		}

		return {
			character: String.fromCharCode(parsed),
			length: targetLen + 2,
			type: "hexadecimal"
		};
	}

	if (options.octal === false) {
		return {
			character: nextChar == "0" ? "\0" : nextChar,
			length: length + 1,
			type: "raw"
		};
	}

	// Octal string
	let octal = 0;
	for (let i = 0; i < 3 && offset + length < len; i++) {
		const oChar = source[offset + length],
			oCC = oChar.charCodeAt(0) - 48;

		if (oCC < 0 || oCC > 7)
			break;

		length++;
		octal = octal * 8 + oCC;
	}

	if (length < 2) {
		return {
			character: nextChar == "0" ? "\0" : nextChar,
			length: nextChar == "0" ? length : length + 1,
			type: "raw"
		};
	}

	return {
		character: String.fromCharCode(octal),
		length,
		type: "octal"
	};
}
