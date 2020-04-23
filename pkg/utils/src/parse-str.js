import parseStrStr from "./parse-str-str";
import hasOwn from "./has-own";

const kwLiterals = {
	true: true,
	false: false,
	NaN: NaN,
	Infinity: Infinity,
	null: null,
	undefined: undefined
};

const symbolParseRegex = /^Symbol(?:.(.*?))?\((.*)\)$/;

export default function parseStr(str) {
	if (typeof str != "string")
		return str;

	// Parse keyword literals (booleans, null, undefined, etc)
	if (hasOwn(kwLiterals, str))
		return kwLiterals[str];
	// Parse numbers
	if (str && !isNaN(Number(str)))
		return Number(str);

	// Every major whitespace character has an ASCII code below or equal to
	// 32, so by checking that range of characters, we can close down the
	// search space significantly and increase performance
	const firstChar = (str.charCodeAt(0) <= 32 && /\s/.test(str[0])) ? str.trim()[0] : str[0];

	// Parse strings and symbols, starting off with a naive (and fast) char check
	switch (firstChar) {
		case "S": {
			const sEx = symbolParseRegex.exec(str);
			if (sEx) {
				if (sEx[1])
					return Symbol[sEx[1]](parseStr(sEx[2]) || sEx[2]);
				return Symbol(parseStr(sEx[2]) || sEx[2]);
			}
		}

			break;
		case "\"":
		case "'":
		case "`": {
			const parsed = parseStrStr(str);
			if (parsed !== null)
				return parsed;

			break;
		}
		case "{":
		case "[":
			return parseObj(str);
	}
	
	return str;
}

function parseObj(objStr) {
	// Try parsing input as JSON else return input string
	try {
		return JSON.parse(objStr);
	} catch (e) {
		return objStr;
	}
}
