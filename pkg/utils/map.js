import forEach from "./for-each";
import { isObj, isArrayLike } from "./is";

export default function map(obj, callback, options, out) {
	out = isObj(out) ? out : isArrayLike(obj) ? [] : {};
	const isArrLike = isArrayLike(out);

	if (typeof callback != "function")
		return out;

	forEach(obj, (v, k, o) => {
		if (isArrLike)
			out.push(callback(v, k, o));
		else
			out[k] = callback(v, k, o);
	}, options);

	return out;
}
