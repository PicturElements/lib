import { isConstructor } from "./is";

export default function matchType(val, type, defaultMatch = true) {
	if (typeof type == "string")
		return typeof val == type;
	else if (typeof type == "function") {
		if (isConstructor(type))
			return typeof val == "object" ? val instanceof type : Boolean(val) && val.constructor == type;
			
		return Boolean(type(val));
	} else if (type && type.constructor == Array) {
		for (let i = type.length - 1; i >= 0; i--) {
			if (matchType(val, type[i], defaultMatch))
				return true;
		}
	}

	return defaultMatch;
}
