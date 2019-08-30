import { isArrayLike } from "./is";
import hasOwn from "./has-own";
import equals from "./equals";

export default function queryObj(list, obj) {
	if (!isArrayLike(list) || !obj || typeof obj != "object") {
		return {
			matches: [],
			indices: [],
			iterations: 0
		};
	}

	let matches = [],
		indices = [],
		iterations = 0;

	for (const k in obj) {
		if (!hasOwn(obj, k))
			continue;

		const srcArr = iterations ? matches : list,
			matchesBuffer = [],
			indicesBuffer = [];

		for (let i = 0, l = srcArr.length; i < l; i++) {
			const val = srcArr[i],
				idx = indices[i] || i;

			if (val && equals(obj[k], val[k])) {
				matchesBuffer.push(val);
				indicesBuffer.push(idx);
			}
		}

		matches = matchesBuffer;
		indices = indicesBuffer;

		iterations++;

		if (!matches.length)
			break;
	}

	// Would be cleaner to populate these arrays
	// before running the main loop
	if (!iterations) {
		for (let i = 0, l = list.length; i < l; i++) {
			indices.push(i);
			matches.push(list[i]);
		}
	}

	return {
		matches,
		indices,
		iterations
	};
}
