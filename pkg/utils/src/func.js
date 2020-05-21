import forEachDeep from "./for-each-deep";
import { resolveVal } from "./resolve-val";
import { sym } from "./sym";
import { getGlobalScope } from "./env";

function call(func, ...args) {
	if (typeof func == "function")
		return func.apply(this, args);
}

function apply(thisVal, func, ...args) {
	if (typeof func == "function")
		return func.apply(thisVal, args);
}

const fixedBindKey = sym("fixedBind key");

function bind(func, ...args) {
	if (typeof func == "function")
		return func[fixedBindKey] ? func : func.bind(...args);

	console.error("Supplied bind target is not a function");
	return null;
}

function fixedBind(func, ...args) {
	if (typeof func == "function") {
		const bound = bind(func, ...args);
		bound[fixedBindKey] = true;
	}

	console.error("Supplied bind target is not a function");
	return null;
}

const deepBindOriginalKey = sym("deepBind original key");

// Warning: mutates the target object, but keeps an original copy
function deepBind(struct, thisVal, options) {
	forEachDeep(struct, (e, k, o) => {
		if (typeof e == "function") {
			const original = e[deepBindOriginalKey] || e,
				tVal = resolveVal(thisVal, e, k, o);

			o[k] = bind(original, tVal);
			o[k][deepBindOriginalKey] = original;
		}
	}, options);
}

// Resolves a function upon first call and optimizes subsequent calls
// where possible. There are three modes:
//
// 1:	context substitution (resolver, key)
//		Resolves the function and replaces the method on the context
//		at this[key]. If the value at that property doesn't match
//		the temporary resolver manager function an error will be logged
//		If the context value is window, an error will also be logged
//		as otherwise accidental pollution of the global scope could happen
//
// 2:	target substitution (target, resolver, key)
//		Works like context substitution, but here the target is explicitly given
//
// 3:	proxying (resolver)
//		The function is merely wrapped in a proxy function

// Clones from ./is to prevent circular dependencies
function isPrimitive(val) {
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

function resolveFunc(resolverOrTarget, keyOrResolver, key = null) {
	if (typeof resolverOrTarget == "function" && isValidObjectKey(keyOrResolver)) {
		let func = function() {
			if (this == getGlobalScope())
				return console.error("Cannot resolve function: refusing to resolve on global scope");
			if (isPrimitive(this))
				return console.error("Cannot resolve function: cannot resolve on primitive value", this);
			if (this[keyOrResolver] != func)
				return console.error(`Cannot resolve function: given key '${keyOrResolver}' doesn't match at target`, this);

			func = resolverOrTarget.apply(this, arguments);
			this[keyOrResolver] = func;
			return func.apply(this, arguments);
		};
	
		return func;
	} else if (typeof keyOrResolver == "function" && isValidObjectKey(key)) {
		if (isPrimitive(resolverOrTarget))
			return console.error("Cannot resolve function: cannot resolve on primitive value", resolverOrTarget);

		let func = function() {
			if (resolverOrTarget[key] != func)
				return console.error(`Cannot resolve function: given key '${key}' doesn't match at target`, resolverOrTarget);

			func = keyOrResolver.apply(this, arguments);
			resolverOrTarget[key] = func;
			return func.apply(this, arguments);
		};
	
		return func;
	} else if (typeof resolverOrTarget == "function") {
		let func = function() {
			func = resolverOrTarget.apply(this, arguments);
			return func.apply(this, arguments);
		};
	
		return function() {
			return func.apply(this, arguments);
		};
	} else
		return console.error("Cannot resolve function");
}

export {
	call,
	apply,
	bind,
	fixedBind,
	deepBind,
	resolveFunc
};
