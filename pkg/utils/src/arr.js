import { isMapLike } from "./lazy/is";
import map from "./map";

function from(candidate) {
	if (isMapLike(candidate))
		return map(candidate, (v, k) => [k, v], null, []);
	else
		return map(candidate, null, null, []);
}

export {
	from
};
