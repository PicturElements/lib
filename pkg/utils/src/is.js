import {
	symbolIteratorKey,
	polyfillPrefixes
} from "./_constants";

const docAll = typeof document == "undefined" ? [] : document.all;

function isDirectInstanceof(obj, constr) {
	return obj !== null && obj !== undefined && obj.constructor == constr;
}

// Checks if a value is a native simple object, i.e. a direct instance of Object or Array
function isNativeSimpleObject(val) {
	if (typeof val != "object" || val == null)
		return false;

	const constr = Object.getPrototypeOf(val).constructor;
	return constr == Object || constr == Array;
}

function isObj(val) {
	return val !== null && typeof val == "object";
}

function isObject(val) {
	return !!val && Object.getPrototypeOf(val) == Object.prototype;
}

function isInstance(val) {
	return val !== null && val !== undefined && Object.getPrototypeOf(val) != Function.prototype;
}

function isConstructor(val) {
	return val !== null && val !== undefined && val.prototype != null && val.prototype.constructor == val;
}

const isSymbol = typeof Symbol == "undefined" ? candidate => {
	return typeof candidate == "string" && candidate.indexOf(polyfillPrefixes.symbol) == 0;
} : candidate => {
	return typeof candidate == "symbol";
};

const isIterable = typeof Symbol == "undefined" ? candidate => {
	if (candidate === docAll || typeof candidate == "string")
		return true;

	if (candidate == null || typeof candidate != "object")
		return false;

	return symbolIteratorKey in candidate;
} : candidate => {
	if (candidate === docAll || typeof candidate == "string")
		return true;

	if (candidate == null || typeof candidate != "object")
		return false;

	return Symbol.iterator in candidate;
};

function isArrayLike(candidate) {
	if (Array.isArray(candidate) || typeof candidate == "string" || candidate === docAll)
		return true;

	if (!candidate || typeof candidate != "object" || typeof candidate.length != "number")
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

const isSetLike = typeof Set == "undefined" ? _ => false : candidate => {
	return candidate instanceof Set;
};

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

export {
	isDirectInstanceof,
	isNativeSimpleObject,
	isObj,
	isObject,
	isInstance,
	isConstructor,
	isSymbol,
	isIterable,
	isArrayLike,
	isSetLike,
	isArrResolvable,
	isEnv
};
