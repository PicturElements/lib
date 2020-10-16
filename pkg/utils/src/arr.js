import { PolySet } from "./internal/poly";
import { isMapLike } from "./lazy/is";
import map from "./map";
import forEach from "./for-each";
import filterMut from "./filter-mut";

function nub(arr) {
	const set = new PolySet(map(arr, v => v)),
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

function pick(arr) {
	return arr[Math.floor(Math.random() * arr.length)];
}

export {
	nub,
	from,
	remFromArr,
	pick
};
