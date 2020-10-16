import map from "./map";
import hasOwn from "./has-own";
import filterMut from "./filter-mut";

export default function filter(obj, callback, options) {
	const mapCallback = typeof callback == "function" ?
		(v, k, o) => callback(v, k, o) ? v : map.SKIP :
		v => v;

	const mapped = map(obj, mapCallback, options);

	if (Array.isArray(mapped))
		filterMut(mapped, (_, k) => hasOwn(mapped, k));

	return mapped;
}
