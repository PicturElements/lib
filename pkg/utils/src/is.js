import {
	SYM_ITER_KEY,
	POLYFILL_PREFIXES
} from "./internal/constants";
import hasOwn from "./has-own";
import getFunctionName from "./get-function-name";
import type from "./lazy/type";

const docAll = typeof document == "undefined" ? [] : document.all;

function isDirectInstanceof(obj, constr) {
	return obj !== null && obj !== undefined && obj.constructor == constr;
}

// Checks if a value is a native simple object, i.e. a direct instance of Object or Array
function isNativeSimpleObject(val) {
	if (typeof val != "object" || val == null)
		return false;

	const proto = Object.getPrototypeOf(val);
	if (!proto)
		return true;

	const constr = proto.constructor;
	return constr == Object || constr == Array;
}

function isObj(val) {
	return val !== null && typeof val == "object";
}

function isObject(val) {
	return Object.prototype.toString.call(val) == "[object Object]";
}

function isInstance(val) {
	return val !== null && val !== undefined && Object.getPrototypeOf(val) != Function.prototype;
}

function isConstructor(val) {
	return val !== null && val !== undefined && val.prototype != null && val.prototype.constructor == val;
}

// Basic and highly speculative measure of whether a supplied value
// is a constructor. Because normal functions are technically constructible,
// this function attempts to apply some heuristics to input, so functions
// must not be defined using arrow notation, should not return anything,
// and the constructor must begin with a capital letter
const handler = { construct: _ => ({}) },
	nonConstructibleRegex = /^(?:\([^)]*\)|[\w\s]+)=>|return[^\n;]+;[\s\n]*}/,
	constructibleRegex = /^\s*class/;

function isProbableConstructor(val) {
	// Remove any definite false values
	if (!isConstructor(val) || isNonConstructible(val))
		return false;

	// Definitely true if the provided function is native
	if (isNativeConstructor(val))
		return true;

	if (typeof Proxy != "undefined") {
		try {
			new (new Proxy(val, handler))();
		} catch {
			// Definitely not constructible if there's no [[Construct]] internal method
			return false;
		}
	}

	const constrStr = val.toString();

	// Test for functions that are definitely constructible
	if (constructibleRegex.test(constrStr))
		return true;

	// If the function is defined using fat arrow notation
	// or returns anything, it's most likely not a constructor
	if (nonConstructibleRegex.test(constrStr))
		return false;

	return isUpperCase(getFunctionName(val)[0]);
}

function isNativeConstructor(val) {
	if (type.getNativeCode(val))
		return true;

	return isConstructor(val) && isNativeFunction(val) && isUpperCase(getFunctionName(val)[0]);
}

function isNonConstructible(val) {
	return typeof Symbol != "undefined" && val == Symbol;
}

function isPrimitive(val) {
	if (!val && val !== docAll)
		return true;

	switch (typeof val) {
		case "object":
		case "function":
			return false;
	}

	return true;
}

function isValidObjectKey(key) {
	switch (typeof key) {
		case "string":
		case "symbol":
			return true;
	}

	return false;
}

const isSymbol = typeof Symbol == "undefined" ? candidate => {
	return typeof candidate == "string" && candidate.indexOf(POLYFILL_PREFIXES.symbol) == 0;
} : candidate => {
	return typeof candidate == "symbol";
};

const isIterable = typeof Symbol == "undefined" ? candidate => {
	if (candidate === docAll || typeof candidate == "string")
		return true;

	if (candidate == null || typeof candidate != "object")
		return false;

	return SYM_ITER_KEY in candidate;
} : candidate => {
	if (candidate === docAll || typeof candidate == "string")
		return true;

	if (candidate == null || typeof candidate != "object")
		return false;

	return Symbol.iterator in candidate;
};

function isArrayLike(candidate) {
	// Common array-likes
	if (Array.isArray(candidate) || typeof candidate == "string" || candidate === docAll)
		return true;

	// Non-objects or objects without a numerical length property
	if (!candidate || typeof candidate != "object" || typeof candidate.length != "number")
		return false;

	// Object instances or the window object (Arguments objects are not included)
	if ((candidate.constructor == Object && String(candidate) != "[object Arguments]") || (typeof window == "object" && candidate == window))
		return false;

	// If the object is syntactically an array, see if Array.prototype.slice
	// can slice a single element from the supposedly array-like object.
	if ([].slice.call(candidate, 0, 1).length == 1)
		return true;

	// If the array-like candidate has a length of 0, make sure the object is
	// empty. Array-like objects normally don't contain such fluff, and
	// the length property should be unenumerable or a prototype prop.
	return candidate.length == 0 && Object.keys(candidate).length == 0;
}

function isArrResolvable(candidate) {
	if (isArrayLike(candidate))
		return true;

	if (typeof Set != "undefined" && candidate instanceof Set)
		return true;

	return false;
}

function isEnv(env, def = "production") {
	if (typeof process == "undefined")
		return env == def;

	return process.env.NODE_ENV == env;
}

function isNativeFunction(candidate) {
	if (typeof candidate != "function")
		return false;

	const funcStr = candidate.toString();
	let foundOpenBrace = false;

	if (funcStr.length > 500)
		return false;

	for (let i = 0, l = funcStr.length; i < l; i++) {
		const c = funcStr[i];

		if (foundOpenBrace) {
			if (c == "[")
				return funcStr.substring(i, i + 13) == "[native code]";

			if (!isWhitespace(c))
				return false;
		} else if (c == "{")
			foundOpenBrace = true;
	}

	return false;
}

function isWhitespace(char) {
	if (typeof char != "string" || char.length != 1)
		return false;

	const code = char.charCodeAt(0);
	return code > 8 && code < 14 || code == 32;
}

function isDigit(char) {
	if (typeof char != "string" || char.length != 1)
		return false;

	const code = char.charCodeAt(0);
	return code >= 48 && code <= 57;
}

function isHexDigit(char) {
	if (typeof char != "string" || char.length != 1)
		return false;

	const code = char.charCodeAt(0);
	return (code >= 48 && code <= 57) || (code >= 97 && code <= 102) || (code >= 65 && code <= 70);
}

function isLowerCase(char) {
	return char.toLowerCase() == char;
}

function isUpperCase(char) {
	return char.toUpperCase() == char;
}

function isEmptyString(str) {
	if (typeof str != "string")
		return false;

	return !str.trim();
}

function isThenable(candidate) {
	if (!candidate)
		return false;

	return typeof candidate.then == "function";
}

function isTaggedTemplateArgs(args) {
	if (!Array.isArray(args))
		return false;

	const firstArg = args[0];

	return Boolean(firstArg && firstArg.raw) && Array.isArray(firstArg) && Array.isArray(firstArg.raw);
}

function isStandardPropertyDescriptor(descriptor) {
	if (!descriptor || !hasOwn(descriptor, "value"))
		return false;

	return descriptor.writable && descriptor.enumerable && descriptor.configurable;
}

export {
	isDirectInstanceof,
	isNativeSimpleObject,
	isObj,
	isObject,
	isInstance,
	isConstructor,
	isProbableConstructor,
	isNativeConstructor,
	isPrimitive,
	isValidObjectKey,
	isSymbol,
	isIterable,
	isArrayLike,
	isArrResolvable,
	isEnv,
	isNativeFunction,
	isWhitespace,
	isDigit,
	isHexDigit,
	isLowerCase,
	isUpperCase,
	isEmptyString,
	isThenable,
	isTaggedTemplateArgs,
	isStandardPropertyDescriptor
};
