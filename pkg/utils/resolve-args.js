import matchType from "./match-type";
import clone from "./clone";
import { genFuncParamsStr } from "./ts-str";
import { isObj } from "./is";

// Resolves arguments using a "lacuna" technique:
// It steps through the parameter signature array and tries to match the next
// argument with the type provided from the parameter object
// It matches as follows:
// If the type is a string the supplied argument is tested with typeof
// If the type is a constructor the argument is tested with instanceof
// If the type is an array the argument is tested for any match of the array's types
// If the type is unspecified there is a match by default
// 
// If it matches, the current argument is set as a named argument
// If it doesn't match, the default value provided by the parameter argument is
// set as the named argument and the next parameter is tested for a match, unless
// the argument is null or undefined. In this case it's treated as an empty argument
// and the next argument is lined up for matching
// If there is no match and the parameter is set as required, an error will be thrown
// with a description of the proper parameter signature

export default function resolveArgs(args, signature, funcName = "func") {
	const argsOut = {
			rest: []
		},
		aLen = args.length,
		sLen = signature.length;
	let i = 0,
		ptr = 0;

	for (i; i < sLen; i++) {
		const sgn = signature[i],
			arg = args[ptr],
			def = sgn.default;
		
		if (matchType(arg, sgn.type)) {
			argsOut[sgn.name] = arg;
			ptr++;
		} else {
			if (arg == null)
				ptr++;

			argsOut[sgn.name] = isObj(def) ? clone(def) : def;

			if (sgn.required) {
				const err = new Error(`Failed to resolve arguments: '${sgn.name}' is a required parameter\n\n${genFuncParamsStr(funcName, signature, true)}\n`);
				// Remove this function from the default stack trace printout in the console
				err.stack = err.stack.replace(/^[\t ]*at [^\n]+\n/m, "");
				throw err;
			}
		}
	}

	while (ptr < aLen)
		argsOut.rest.push(args[ptr++]);

	return argsOut;
}
