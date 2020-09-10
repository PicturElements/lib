import matchType from "./match-type";
import clone from "./clone";
import { genFuncParamsStr } from "./ts-str";
import {
	isObj,
	isObject,
	isArrayLike
} from "./is";
import getFunctionName from "./get-function-name";
import hasOwn from "./has-own";
import {
	composeOptionsTemplates,
	createOptionsObject
} from "./internal/options";

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
// { num1: num1, num2: num2, str1: str1, str2: --, rest: [str2] }
//
// resolveArgs options:
// allowSingleSource
// returnArgList
//
// allowSingleSource:
// If this flag is truthy and the first argument is an object, resolveArgs will
// use that as the source for its arguments. Type chacking and output remain the same
// Surplus arguments are returned as rest arguments. Will fail if the first parameter signature
// parameter can match an object, as the arguments then become ambiguous
//
// returnArgList:
// resolveArgs returns an array of all arguments in the order specified by the signature
// Rest arguments are appended to the end of the array
//
// Signature parameter options:
// name: string
// required: boolean
// default: any
// coalesce: boolean
// resolve: function
// alias / aliases: string | string[]
//
// name:
// Parameter name
//
// required:
// Makes parameter required. If there's no correct match, an error will be thrown
//
// default:
// Default value used if an argument doesn't match. Defaults to undefined
//
// coalesce:
// If truthy, arguments will be added to an array as long as the type matcher matches
// The array will be used as the named argument. Default values are still supported, but
// are added to the array instead of the outbound arguments
//
// resolve:
// Method that resolves failing arguments. The resulting value from this is run through
// type matching
//
// alias / aliases
// An alias or set of aliases to be used to retrieve argument data in allowSingleSource
// mode if no data for the parameter name is found. Note that the argument will be named
// after the parameter name, and not the input key
// 'alias' / 'aliases' can be used interchangeably, but 'aliases' receives precedence
const OPTIONS_TEMPLATES = composeOptionsTemplates({
	allowSingleSource: true,
	returnArgList: true
});

export default function resolveArgs(args, signature, options) {
	options = createOptionsObject(options, OPTIONS_TEMPLATES);

	if (!isArrayLike(args))
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
		if (matchType({}, signature[0].type, "falseDefault"))
			throw new Error("Failed to resolve arguments: argument ambiguity; first argument of function that supports single source arguments cannot be an object. There is no way to determine which type of argument should be used from arguments alone");

		useSingleSource = true;
	}

	for (let i = 0; i < sLen; i++) {
		const sgn = signature[i],
			arg = useSingleSource ?
				resolveArg(args[0], sgn) :
				args[argPtr],
			def = sgn.default,
			key = options.returnArgList ?
				i :
				sgn.name;

		if (sgn.coalesce && argPtr >= args.length) {
			argsOut[key] = argsOut[key] || [];
			break;
		}

		if (arg != null && matchType(arg, sgn.type)) {
			if (sgn.coalesce) {
				argsOut[key] = argsOut[key] || [];
				argsOut[key].push(arg);
				i--;
			} else
				argsOut[key] = arg;

			argPtr++;
		} else {
			if (typeof sgn.resolve == "function") {
				const resolved = sgn.resolve(arg, sgn);

				if (matchType(resolved, sgn.type)) {
					if (sgn.coalesce) {
						argsOut[key] = argsOut[key] || [];
						argsOut[key].push(resolved);
						i--;
					} else
						argsOut[key] = resolved;

					argPtr++;
					continue;
				}
			}

			if (sgn.coalesce && (argsOut[key] || !sgn.required)) {
				argsOut[key] = argsOut[key] || [];
				continue;
			}

			if (arg == null)
				argPtr++;

			argsOut[key] = isObj(def) ? clone(def) : def;

			if (sgn.required) {
				const err = new Error(`(resolveArgs) Failed to resolve arguments: '${sgn.name}' is a required parameter\n\n${genFuncParamsStr("fn", signature, true)}\n`);
				// Remove this function from the default stack trace printout in the console (Chromium only)
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

resolveArgs.wrap = (func, signature, options) => {
	options = Object.assign(
		{},
		createOptionsObject(options, OPTIONS_TEMPLATES),
		{
			returnArgList: true
		}
	);

	const wrapped = function() {
		return func.apply(
			this,
			resolveArgs(arguments, signature, options)
		);
	};

	wrapped.signature = genFuncParamsStr(getFunctionName(func) || "fn", signature, true);
	wrapped.rawSignature = signature;

	return wrapped;
};

function resolveArg(source, sgn) {
	if (hasOwn(source, sgn.name))
		return source[sgn.name];

	const al = sgn.aliases || sgn.alias;

	if (typeof al == "string" && hasOwn(source, al))
		return source[al];

	if (Array.isArray(al)) {
		for (let i = 0, l = al.length; i < l; i++) {
			if (typeof al[i] == "string" && hasOwn(source, al[i]))
				return source[al[i]];
		}
	}

	return null;
}
