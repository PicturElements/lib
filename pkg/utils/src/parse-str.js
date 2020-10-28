import { firstChar } from "./string";
import parseStrStr from "./parse-str-str";
import hasOwn from "./has-own";

const KW_LITERALS = {
	true: true,
	false: false,
	NaN: NaN,
	Infinity: Infinity,
	null: null,
	undefined: undefined
};

const SYM_PARESE_REGEX = /^\s*Symbol(?:.(.*?))?\((.*)\)\s*$/;

export default function parseStr(str) {
	if (typeof str != "string")
		return str;

	// Parse keyword literals (booleans, null, undefined, etc)
	if (hasOwn(KW_LITERALS, str))
		return KW_LITERALS[str];
	// Parse numbers
	if (str && !isNaN(Number(str)))
		return Number(str);

	// Parse strings and symbols, starting off with a naive (and fast) char check
	switch (firstChar(str)) {
		case "S": {
			const sEx = SYM_PARESE_REGEX.exec(str);
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
