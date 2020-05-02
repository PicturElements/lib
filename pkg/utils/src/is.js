import {
	SYM_ITER_KEY,
	POLYFILL_PREFIXES
} from "./internal/constants";
import hasOwn from "./has-own";
import getFunctionName from "./get-function-name";

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
	if (!val)
		return false;

	const proto = Object.getPrototypeOf(val);
	return proto == null || proto == Object.prototype;
}

function isInstance(val) {
	return val !== null && val !== undefined && Object.getPrototypeOf(val) != Function.prototype;
}

function isConstructor(val) {
	return val !== null && val !== undefined && val.prototype != null && val.prototype.constructor == val;
}

function isNativeConstructor(val) {
	return isConstructor(val) && isNativeFunction(val) && isUpperCase(getFunctionName(val)[0]);
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

function isLowerCase(char) {
	return char.toLowerCase() == char;
}

function isUpperCase(char) {
	return char.toUpperCase() == char;
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
	isLowerCase,
	isUpperCase,
	isThenable,
	isTaggedTemplateArgs,
	isStandardPropertyDescriptor
};
