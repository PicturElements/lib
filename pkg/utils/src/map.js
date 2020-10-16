import {
	isObj,
	isPrimitive,
	isArrResolvable
} from "./is";
import {
	mkEntrySetter
} from "./collection";
import forEach from "./for-each";

export default function map(obj, callback, options, out) {
	if (isPrimitive(obj) && typeof obj != "string")
		return obj;

	if (!isObj(out)) {
		if (options && options.nativeSimple)
			out = isArrResolvable(obj) ? [] : {};
		else if (typeof obj == "string")
			out = obj;
		else
			out = new (obj.constructor || Object)();
	}

	callback = typeof callback == "function" ?
		callback :
		v => v;

	const set = mkEntrySetter(out);

	forEach(obj, (v, k, o) => {
		const value = callback(v, k, o);

		if (typeof value != "object" || value != map.SKIP)
			out = set(k, value, v);
	}, options);

	return out;
}

map.SKIP = Object.freeze({});
