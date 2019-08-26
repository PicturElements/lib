import matchType from "./match-type";
import clone from "./clone";
import { genFuncParamsStr } from "./ts-str";
import {
	isObj,
	isObject
} from "./is";
import getFunctionName from "./get-function-name";

// Resolves arguments using a simple "lacuna" algorithm:
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
// the argument is nullish. In this case it's treated as an empty argument
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
//
// options:
// allowSingleSource	- allow a single source argument object to be passed and used as the argument data
// returnArgList		- return as an array of arguments
//
// allowSingleSource:
// If this flag is truthy and the first argument is an object, resolveArgs will
// use that as the source for its arguments. Type chacking and output remain the same
// Surplus arguments are returned as rest arguments
//
// returnArgList:
// Simply returns an array of all arguments in the order specified by the signature
// Rest arguments are appended to the end of the array

export default function resolveArgs(args, signature, options = {}) {
	if (!Array.isArray(args))
		throw new Error("Failed to resolve arguments: no arguments supplied");

	if (!Array.isArray(signature))
		throw new Error("Failed to resolve arguments: no signature specified");

	const argsOut = options.returnArgList ? [] : {
			rest: []
		},
		aLen = args.length,
		sLen = signature.length;
	let argPtr = 0,
		useSingleSource = false;

	if (options.allowSingleSource && isObject(args[0])) {
		if (matchType({}, signature[0].type, false))
			throw new Error("Failed to resolve arguments: argument ambiguity; first argument of function that supports single source arguments cannot be an object. There is no way to determine which type of argument should be used from arguments alone");
	
		useSingleSource = true;
	}

	for (let i = 0; i < sLen; i++) {
		const sgn = signature[i],
			arg = useSingleSource ? args[0][sgn.name] : args[argPtr],
			def = sgn.default,
			key = options.returnArgList ? i : sgn.name;
		
		if (matchType(arg, sgn.type)) {
			argsOut[key] = arg;
			argPtr++;
		} else {
			if (arg == null)
				argPtr++;

			argsOut[key] = isObj(def) ? clone(def) : def;

			if (sgn.required) {
				const err = new Error(`Failed to resolve arguments: '${sgn.name}' is a required parameter\n\n${genFuncParamsStr("fn", signature, true)}\n`);
				// Remove this function from the default stack trace printout in the console
				err.stack = err.stack.replace(/^[\t ]*at [^\n]+\n/m, "");
				throw err;
			}
		}
	}

	if (useSingleSource)
		argPtr = 1;

	const rest = options.returnArgList ? argsOut : argsOut.rest;

	while (argPtr < aLen)
		rest.push(args[argPtr++]);

	return argsOut;
}

resolveArgs.wrap = (signature, func, options) => {
	const wrapped = function() {
		return func.apply(
			this,
			resolveArgs(arguments, signature,
				Object.assign({}, options, {
					returnArgList: true
				})
			)
		);
	};

	wrapped.signature = genFuncParamsStr(getFunctionName(func) || "fn", signature, true);
	wrapped.rawSignature = signature;

	return wrapped;
};
