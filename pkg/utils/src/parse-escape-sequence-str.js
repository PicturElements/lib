import parseEscapeSequence from "./parse-escape-sequence";

export default function parseEscapeSequenceStr(str, options = {}) {
	str = String(str);
	let out = "";

	for (let i = 0, l = str.length; i < l; i++) {
		const char = str[i];

		if (char == "\\") {
			const parsed = parseEscapeSequence(str, i, options);
			out += parsed.character;
			i += parsed.length - 1;
		} else
			out += char;
	}

	return out;
}
