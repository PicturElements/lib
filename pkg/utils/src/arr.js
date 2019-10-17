import { isMapLike } from "./lazy/is";
import map from "./map";
import filterMut from "./filter-mut";

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
	from,
	remFromArr
};
