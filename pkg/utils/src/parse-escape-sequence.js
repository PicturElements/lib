import hasOwn from "./has-own";

const KEYWORD_ESCAPES = {
	n: "\n",
	r: "\r",
	t: "\t",
	f: "\f",
	v: "\v"
};

export default function parseEscapeSequence(source, offset = 0) {
	const sLen = source.length;
	let length = 0;

	if (source[offset] != "\\" || source.length < offset + 1) {
		return {
			character: "",
			length,
			type: "none"
		};
	}

	length++;
	const nextChar = source[offset + 1];

	if (hasOwn(KEYWORD_ESCAPES, nextChar)) {
		return {
			character: KEYWORD_ESCAPES[nextChar],
			length: length + 1,
			type: "keyword"
		};
	}

	// Hex string
	if (nextChar == "u" || nextChar == "x") {
		const targetLen = nextChar == "u" ? 4 : 2,
			sequence = source.substring(offset + length + 1, offset + length + targetLen + 1);

		if (sequence.length != targetLen || isNaN(Number(sequence))) {
			return {
				character: nextChar,
				length: length + 1,
				type: "raw"
			};
		}

		return {
			character: String.fromCharCode(parseInt(sequence, 16)),
			length: targetLen + 3,
			type: "hexadecimal"
		};
	}

	// Octal string
	let octal = 0;
	for (let i = 0; i < 3 && offset + length < sLen; i++) {
		const oChar = source[offset + length],
			oCC = oChar.charCodeAt(0) - 48;

		if (oCC < 0 || oCC > 7) {
			if (!i) {
				return {
					character: nextChar,
					length: length + 1,
					type: "raw"
				};
			}

			break;
		}

		length++;
		octal = octal * 8 + oCC;
	}

	return {
		character: String.fromCharCode(octal),
		length,
		type: "octal"
	};
}
