import { isArrayLike } from "./is";
import hasOwn from "./has-own";
import queryMatch from "./query-match";
import {
	composeOptionsTemplates,
	createOptionsObject
} from "./options";

export default function query(list, q, options) {
	options = createOptionsObject(options, queryTemplates);

	if (!isArrayLike(list) || !q || typeof q != "object") {
		return {
			matches: [],
			indices: [],
			iterations: 0
		};
	}

	let matches = [],
		indices = [],
		iterations = 0;

	for (const k in q) {
		if (!hasOwn(q, k))
			continue;

		const srcArr = iterations ? matches : list,
			matchesBuffer = [],
			indicesBuffer = [];

		for (let i = 0, l = srcArr.length; i < l; i++) {
			const val = srcArr[i],
				idx = indices[i] || i;

			if (val && queryMatch(val[k], q[k], options)) {
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
	if (!iterations && q) {
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

const queryTemplates = composeOptionsTemplates({
	smart: true,
	deep: true
});
