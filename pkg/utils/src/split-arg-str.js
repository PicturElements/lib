import { cleanRegex } from "./regex";

const argSeparatorCache = {};

export default function splitArgStr(str, argSeparator = ",") {
	const args = [];
	let isRegexArgSep = argSeparator instanceof RegExp,
		quote = null,
		structStackDepth = 0,
		arg = "",
		lastChar = null;

	if (isRegexArgSep) {
		const key = argSeparator.toString();

		if (argSeparatorCache.hasOwnProperty(key))
			argSeparator = argSeparatorCache[key];
		else {
			const flags = argSeparator.flags.indexOf("g") == -1 ?
				`${argSeparator.flags}g` :
				argSeparator.flags;

			argSeparator = new RegExp(argSeparator.source, flags);
			argSeparatorCache[key] = argSeparator;
		}
	} else if (!argSeparator || typeof argSeparator != "string") {
		console.warn(`Argument separator (${argSeparator}) is invalid. Expect bad output`);
		argSeparator = "";
	} else if (argSeparator.length > 1) {
		if (argSeparatorCache.hasOwnProperty(argSeparator))
			argSeparator = argSeparatorCache[argSeparator];
		else
			argSeparator = argSeparatorCache[argSeparator] = new RegExp(cleanRegex(argSeparator), "gi");

		isRegexArgSep = true;
	}

	for (let i = 0, l = str.length; i < l; i++) {
		const char = str[i];

		if (isRegexArgSep && !quote && !structStackDepth) {
			argSeparator.lastIndex = i;
			const ex = argSeparator.exec(str);

			if (ex && ex.index == i) {
				args.push(arg.trim());
				arg = "";
				i += ex[0].length - 1;
				continue;
			}
		}

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
