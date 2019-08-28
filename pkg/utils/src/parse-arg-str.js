import parseStr from "./parse-str";

export default function parseArgStr(str, argSeparator) {
	return splitArgStr(str, argSeparator).map(parseStr);
}

function splitArgStr(str, argSeparator = ",") {
	const args = [];
	let quote = null,
		structStackDepth = 0,
		arg = "",
		lastChar = null;

	for (let i = 0, l = str.length; i < l; i++) {
		const char = str[i];

		switch (char) {
			case "\\":
				arg += str[i + 1] || "";
				i++;
				continue;
			case argSeparator:
				if (!quote && !structStackDepth) {
					args.push(arg.trim());
					arg = "";
					continue;
				}
				break;
			case "\"":
			case "'":
			case "`":
				if (char == quote)
					quote = null;
				else
					quote = char;
				break;
			case "[":
			case "{":
				if (!quote)
					structStackDepth++;
				break;
			case "]":
			case "}":
				if (!quote)
					structStackDepth--;
				break;
		}

		arg += char;
		lastChar = char;
	}

	if (arg || lastChar == argSeparator)
		args.push(arg.trim());
	
	return args;
}
