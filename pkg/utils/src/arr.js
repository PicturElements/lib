import { isMapLike } from "./lazy/is";
import map from "./map";
import filterMut from "./filter-mut";
import QNDSet from "./qnd-set";
import forEach from "./for-each";

function nub(arr) {
	const set = new QNDSet(arr),
		out = [];

	forEach(set, v => out.push(v));
	return out;
}

function from(candidate) {
	if (isMapLike(candidate))
		return map(candidate, (v, k) => [k, v], null, []);
	else
		return map(candidate, null, null, []);
}

function remFromArr(arr, item, g = true) {
	const nan = typeof item == "number" && isNaN(item);
	let filtered = false;

	return filterMut(arr, v => {
		if (!g && filtered)
			return true;

		if (v == item || nan && typeof v == "number" && isNaN(v)) {
			filtered = true;
			return false;
		}

		return true;
	});
}

export {
	nub,
	from,
	remFromArr
};
