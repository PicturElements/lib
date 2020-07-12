import {
	cleanRegex,
	injectRegexFlags,
	stickyExec
} from "./regex";
import hasOwn from "./has-own";
import supports from "./internal/supports";

const argSeparatorCache = {};

export default function splitArgStr(str, argSeparator = ",") {
	const args = [];
	let useRegexArgSep = argSeparator instanceof RegExp,
		quote = null,
		structStackDepth = 0,
		arg = "",
		lastChar = null;

	if (useRegexArgSep) {
		const key = argSeparator.toString();

		if (hasOwn(argSeparatorCache, key))
			argSeparator = argSeparatorCache[key];
		else {
			if (supports.regex.sticky)
				argSeparator = injectRegexFlags(argSeparator, "y", true);
			else
				argSeparator = injectRegexFlags(argSeparator, "g", true);

			argSeparatorCache[key] = argSeparator;
		}
	} else if (typeof argSeparator != "string") {
		console.warn(`Argument separator with is invalid: type ${typeof argSeparator}`);
		argSeparator = "";
	} else if (!argSeparator) {
		console.warn(`Argument separator is invalid: empty string`);
		argSeparator = "";
	} else if (argSeparator.length > 1) {
		if (hasOwn(argSeparatorCache, argSeparator))
			argSeparator = argSeparatorCache[argSeparator];
		else
			argSeparator = argSeparatorCache[argSeparator] = new RegExp(cleanRegex(argSeparator), "gi");

		useRegexArgSep = true;
	}

	for (let i = 0, l = str.length; i < l; i++) {
		const char = str[i];

		if (useRegexArgSep && !quote && !structStackDepth) {
			const ex = stickyExec(argSeparator, str, i);

			if (ex && ex.index == i) {
				args.push(arg);
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
					args.push(arg);
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

			case " ":
			case "\n":
			case "\r":
			case "\t":
			case "\f":
			case "\v":
				if (quote || structStackDepth > 0)
					arg += char;
				continue;

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

	if (arg || (useRegexArgSep && lastChar == argSeparator))
		args.push(arg);

	return args;
}
