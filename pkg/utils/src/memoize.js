import { sym } from "./sym";
import hasOwn from "./has-own";

const memoizeKey = sym("memoize");

export default function memoize(func, ...args) {
	let key = "",
		argLen = args.length;

	while (argLen--) {
		const arg = args[argLen],
			type = typeof arg;

		switch (type) {
			case "function":
			case "symbol":
				return func(...args);
			default:
				if (arg !== null && type == "object")
					return func(...args);
				// only use the first character of the type to boost performance
				// the types that clash don't matter:
				// string - symbol: 	symbols can't be serialized reliably
				// boolean - bigint:	these have different serializations
				key += `${arg}@${type[0]}`;
		}
	}

	if (hasOwn(func, memoizeKey)) {
		if (hasOwn(func[memoizeKey], key))
			return func[memoizeKey][key];
	} else
		func[memoizeKey] = {};

	const val = func(...args);
	func[memoizeKey][key] = val;
	return val;
}
