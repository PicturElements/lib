import matchType from "./match-type";
import clone from "./clone";
import { genFuncParamsStr } from "./ts-str";
import { isObj } from "./is";
import getFunctionName from "./get-function-name";

// Resolves arguments using a "lacuna" algorithm:
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
//
// Note that this implementation preserves argument order, so for example a function
// that takes arguments on the form (number, string, number, string)
// won't accept (number, number, string string) fully
// In this case, resolveArgs would resolve the first number, fail to match the first string,
// resovlve the second number, and finally resolve the first string in the arguments
// The second argument string would become a rest argument
// { rest: [str2], num1: num1, num2: num2, str1: str1, str2: -- }

export default function resolveArgs(args, signature, funcName = "func", useArr = false) {
	const argsOut = useArr ? [] : {
			rest: []
		},
		aLen = args.length,
		sLen = signature.length;
	let ptr = 0;

	for (let i = 0; i < sLen; i++) {
		const sgn = signature[i],
			arg = args[ptr],
			def = sgn.default,
			key = useArr ? i : sgn.name;
		
		if (matchType(arg, sgn.type)) {
			argsOut[key] = arg;
			ptr++;
		} else {
			if (arg == null)
				ptr++;

			argsOut[key] = isObj(def) ? clone(def) : def;

			if (sgn.required) {
				const err = new Error(`Failed to resolve arguments: '${sgn.name}' is a required parameter\n\n${genFuncParamsStr(funcName, signature, true)}\n`);
				// Remove this function from the default stack trace printout in the console
				err.stack = err.stack.replace(/^[\t ]*at [^\n]+\n/m, "");
				throw err;
			}
		}
	}

	const rest = useArr ? argsOut : argsOut.rest;

	while (ptr < aLen)
		rest.push(args[ptr++]);

	return argsOut;
}

resolveArgs.wrap = (signature, func, funcName = "func") => {
	const wrapped = function() {
		return func.apply(
			this,
			resolveArgs(arguments, signature, funcName, true)
		);
	};

	wrapped.signature = genFuncParamsStr(getFunctionName(func) || funcName, signature, true);
	wrapped.rawSignature = signature;

	return wrapped;
};
