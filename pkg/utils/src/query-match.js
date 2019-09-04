import equals from "./equals";

export default function queryMatch(val, matcher, options) {
	if (val == null)
		return false;

	if (!options.smart)
		return plainMatch(val, matcher, options);

	switch (typeof matcher) {
		case "function":
			return Boolean(matcher(val, options));
	}

	switch (matcher && matcher.constructor) {
		case RegExp:
			if (typeof val == "string")
				return matcher.test(val);
			break;
	}

	return plainMatch(val, matcher, options);
}

function plainMatch(val, matcher, options) {
	if (!options.deepEquality)
		return val === matcher;

	return equals(val, matcher);
}
