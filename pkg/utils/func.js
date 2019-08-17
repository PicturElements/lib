import forEachDeep from "./for-each-deep";
import { resolveVal } from "./resolve-val";
import sym from "./sym";

function call(func, ...args) {
	if (typeof func == "function")
		return func.apply(this, args);
}

function apply(thisVal, func, ...args) {
	if (typeof func == "function")
		return func.apply(thisVal, args);
}

const deepBindOriginalKey = sym("db-original");

// Warning: mutates the target object, but keeps an original copy
function deepBind(struct, thisVal, options) {
	forEachDeep(struct, (e, k, o) => {
		if (typeof e == "function") {
			const original = e[deepBindOriginalKey] || e,
				tVal = resolveVal(thisVal, e, k, o);

			o[k] = original.bind(tVal);
			o[k][deepBindOriginalKey] = original;
		}
	}, options);
}

export {
	call,
	apply,
	deepBind
};
