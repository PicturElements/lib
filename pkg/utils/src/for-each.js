import { SYM_ITER_KEY } from "./internal/constants";
import {
	isArrayLike,
	isDirectInstanceof,
} from "./is";
import {
	isSetLike,
	isMapLike
} from "./lazy/is";
import {
	composeOptionsTemplates,
	createOptionsObject
} from "./options";
import hasOwn from "./has-own";

// Polymorphic forEach
// It efficiently handles the following:
// 1. iteration over array-likes
// 2. iteration over own object keys (with support for symbol polyfill; see sym())
// 3. iteration over iterables (with support for polyfilled iterables; see Map, Set)
// Array-likes that implement the iteration prototcol are iterated over using a standard
// for loop by default. Use the iterable flag to prefer iterators 
//
// It also supports reverse iteration over the same
// Note that this function won't iterate over properties added during iteration if:
// a. they have been added to an array-like before the index pointer (forwards)
// b. they have been added to an array-like after the index pointer (reverse)
// c. the target object is a non-iterable object
// d. the target object is an iterable and the reverse flag is truthy
//
// in general, forEach returns itself. However, this is not the case in the folllowing cases:
//
// forEach supports breaking, continuing, and labels. The syntax is meant
// to be similar to native loops. The general syntax is this:
//
// BREAK		- to break a loop you return forEach.BREAK from the callback function.
//				  this will generate a BREAK token that:
//					1. indicates that you wish to break from the loop
//					2. carries data for which loops to break beyond the first one
//				  You may modify this token by calling it instead on return:
//					forEach.BREAK("label")	- will break every loop until one with the label "label" is found
//					forEach.BREAK(2)		- will break 2 loops
//				  Returning this token will break the internal loop and the same token
//				  will by returning the enclosing forEach witin another forEach will
//				  pass the token on up the chain. Once the token expires, passing it
//				  on will yield no effect
//				  By default, the depth is set to 1 and label is null
// BREAK_ALL	- exactly the same as BREAK, but with a depth set to Infinity
//
// CONTINUE		- to continue a loop you can simply return from it, but if you wish
// 				  to continue an outer loop you may use forEach.CONTINUE instead
//				  Syntactically, forEach.CONTINUE is identical to forEach.BREAK
//				  and uses most of the infrastructure of the latter
//				  by default, the depth is set to 1 and label is null
// CONTINUE_ALL	- exactly the same as CONTINUE, but with a depth set to Infinity
//
// labels		- labels may be used to identify loops. Any non-numerical not-null
//				  value may be used as a label
//
// Options:
// reverse		- iterate in reverse
// iterable		- use iterator if object is iterable over native loop constructs
// isSetLike	- hint that object behaves like a set during iteration, in that
//				  the the returned value at each iteration step represents both
//				  the key and value. It will automatically treat Set instances as set-like
// isMapLike	- hint that object behaves like a map during iteration, in that
//				  if an array is returned at each iteration step, it
//				  will assume that it represents a key-value pair. It will
//				  automatically treat Map instances as map-like. Furthermore,
//				  it will automatically flip the key and value (since forEach
//				  calls callbacks with (value, key, source)). This can be disabled
//				  by explicitly setting flipKV to false
// flipKV		- flip key and value in set-like iteration values. True by default
// sparse		- indicates that the provided object may be sparse, so forEach
//				  should not call the callback on empty properties
// label		- label that can be used to break (nested) forEach
//
// Prefix options:
// options		- forEach.o(options) -> forEach
//				  Pass a valid createOptionsObject data to set the options for forEach
//				  These options are only valid for the next call of forEach and will be overridden
//				  if a new options object is provided in the next forEach invocation
// label		- forEach.l("label") -> forEach
//				  Pass a valid label value (see above) to set in a new options object.
//				  As with forEach.o, it will be overridden if a new options object is provided
//
// Postfix operations
// done			- specify a callback to invoke after the loop has fully finished
//				  no arguments are passed and 'this' is null
// exit			- specify a callback to invoke after the loop has been broken
//				  no arguments are passed and 'this' is null
//				  Note that this will not be called if the loop that was broken was
//				  the last one, as in this case the returned value is forEach itself
//				  and as such it cannot propagate as a token would

export default function forEach(obj, callback, options){
	if (obj === null || obj === undefined || typeof callback != "function")
		return forEach;

	options = createOptionsObject(options || forEach._options, optionsTemplates);
	forEach._options = null;

	if (obj[SYM_ITER_KEY] && (options.iterable || !isArrayLike(obj))) {
		const iterator = obj[SYM_ITER_KEY](),
			setLike = options.isSetLike || isSetLike(obj),
			mapLike = options.isMapLike || isMapLike(obj),
			stack = [];
		let item = null,
			idx = -1;

		while (++idx >= 0) {
			item = iterator.next();
			if (item.done)
				break;

			let vk;

			if (setLike)
				vk = [item.value, item.value];
			else if (mapLike && Array.isArray(item.value)) {
				if (options.flipKV === false)
					vk = item.value;
				else
					vk = [item.value[1], item.value[0]];
			} else // assume number index as key
				vk = [item.value, idx];

			if (options.reverse)
				stack.push(vk);
			else if (callback(vk[0], vk[1], obj) == jmpT) {
				if (shouldContinue(options))
					continue;
				return brk(options);
			}
		}

		// options.reverse
		let i = stack.length;
		while (i--) {
			if (callback(stack[i][0], stack[i][1], obj) == jmpT) {
				if (shouldContinue(options))
					continue;
				return brk(options);
			}
		}
	} else if (isDirectInstanceof(obj, Object) || !isArrayLike(obj)) {
		if (options.reverse) {
			const keys = Object.keys(obj);
			let k;
			
			for (let i = keys.length - 1; i >= 0; i--) {
				k = keys[i];
				// The keys are already own property names,
				// but in browsers where Symbol isn't supported we still
				// need to check for bad keys
				if (hasOwn(obj, keys[i], options.overSymbols) && callback(obj[k], k, obj) == jmpT) {
					if (shouldContinue(options))
						continue;
					return brk(options);
				}
			}
		} else {
			for (let k in obj) {
				if (hasOwn(obj, k, false) && callback(obj[k], k, obj) == jmpT) {
					if (shouldContinue(options))
						continue;
					return brk(options);
				}
			}
		}
	} else {
		const arrCB = options.sparse ? (v, k, obj) => {
			if (hasOwn(obj, k, false))
				callback(v, k, obj);
		} : callback;

		if (options.reverse) {
			for (let i = obj.length - 1; i >= 0; i--) {
				if (arrCB(obj[i], i, obj) == jmpT) {
					if (shouldContinue(options))
						continue;
					return brk(options);
				}
			}
		} else {
			for (let i = 0; i < obj.length; i++) {
				if (arrCB(obj[i], i, obj) == jmpT) {
					if (shouldContinue(options))
						continue;
					return brk(options);
				}
			}
		}
	}

	if (options.overSymbols && typeof Symbol != "undefined") {
		const symbols = Object.getOwnPropertySymbols(obj);

		for (let i = 0, l = symbols.length; i < l; i++) {
			const sym = symbols[i];

			if (callback(obj[sym], sym, obj) == jmpT) {
				if (shouldContinue(options))
					continue;
				return brk(options);
			}
		}
	}

	return forEach;
}

forEach._options = null;
forEach.isBreak = false;
forEach.isContinue = false;

forEach.l = lbl => {
	forEach._options = {
		label: lbl
	};

	return forEach;
};

forEach.o = opt => {
	forEach._options = opt;
	return forEach;
};

forEach.done = function(func) {
	if (this == forEach) {
		if (typeof func == "function")
			func.call(null);
		
		return forEach;
	}

	return jmpT;
};

forEach.exit = function(func) {
	if (this == jmpT) {
		if (typeof func == "function")
			func.call(null);

		return jmpT;
	}

	return forEach;
};

forEach._JMP_TOKEN = depthOrLabel => {
	if (typeof depthOrLabel == "number") {
		jmpObj.label = null;
		jmpObj.depth = depthOrLabel;
	} else {
		jmpObj.label = depthOrLabel;
		jmpObj.depth = Infinity;
	}

	return jmpT;
};

const jmpT = forEach._JMP_TOKEN;

jmpT.done = forEach.done;
jmpT.exit = forEach.exit;
jmpT.isBreak = true;
jmpT.isContinue = false;

forEach._JMP_OBJ = {
	depth: Infinity,
	label: null,
	mode: null
};

const jmpObj = forEach._JMP_OBJ;

Object.defineProperties(forEach, {
	BREAK: {
		get() {
			jmpObj.depth = 1;
			jmpObj.label = null;
			jmpObj.mode = "break";
			return jmpT;
		}
	},
	BREAK_ALL: {
		get() {
			jmpObj.depth = Infinity;
			jmpObj.label = null;
			jmpObj.mode = "break";
			return jmpT;
		}
	},
	CONTINUE: {
		get() {
			jmpObj.depth = 1;
			jmpObj.label = null;
			jmpObj.mode = "continue";
			return jmpT;
		}
	},
	CONTINUE_ALL: {
		get() {
			jmpObj.depth = Infinity;
			jmpObj.label = null;
			jmpObj.mode = "continue";
			return jmpT;
		}
	}
});

function shouldContinue(options) {
	if (jmpObj.mode !== "continue")
		return false;

	if (jmpObj.depth == 1)
		return true;

	if (jmpObj.label !== null && options.label == jmpObj.label)
		return true;
}

// VERY IMPORTANT:
// this function implicitly invalidates tokens by returning
// forEach instead of the token
function brk(options) {
	if (--jmpObj.depth <= 0)
		return forEach;

	if (jmpObj.label !== null && options.label == jmpObj.label)
		return forEach;

	return jmpT;
}

const optionsTemplates = composeOptionsTemplates({
	reverse: true,
	iterable: true,
	isMapLike: true,
	isSetLike: true,
	flipKV: true,
	noFlipKV: {
		flipKV: false
	},
	sparse: true,
	overSymbols: true
});
