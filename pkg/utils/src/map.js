import forEach from "./for-each";
import {
	isObj,
	isArrayLike,
	isArrResolvable
} from "./is";

export default function map(obj, callback, options, out) {
	out = isObj(out) ? out : isArrResolvable(obj) ? [] : {};
	callback = typeof callback == "function" ? callback : v => v;
	const isArrLike = isArrayLike(out);

	forEach(obj, (v, k, o) => {
		if (isArrLike)
			out.push(callback(v, k, o));
		else
			out[k] = callback(v, k, o);
	}, options);

	return out;
}
