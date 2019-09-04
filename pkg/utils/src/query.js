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

	const keys = Object.keys(q);
	// Separate arrays are used because
	// mainly this function deals with filtering
	// and wrapping data would be less intuitive
	let matches = [],
		indices = [],
		matchCounts = [],
		iterations = 0;

	for (let i = 0, l = keys.length; i < l; i++) {
		if (!hasOwn(q, keys[i]))
			continue;

		let {
			key,
			srcKey,
			lazy,
			strict
		} = processKey(keys[i]);

		lazy = (options.lazy && !strict) || (!options.lazy && lazy);

		const srcArr = iterations ? matches : list,
			matchesBuffer = [],
			indicesBuffer = [],
			matchCountsBuffer = [];

		for (let j = 0, l2 = srcArr.length; j < l2; j++) {
			const val = srcArr[j],
				idx = indices[j] || j,
				matchCount = matchCounts[j] || 0, 
				match = val && queryMatch(val[key], q[srcKey], options);

			// If the last key has been reached and there's no match,
			// there there can be no matched result even with lazy
			// matching if there have been no previous matches
			if (match || lazy && (matchCount || i < keys.length - 1)) {
				matchesBuffer.push(val);
				indicesBuffer.push(idx);
				matchCountsBuffer.push(matchCount + 1);
			}
		}

		matches = matchesBuffer;
		indices = indicesBuffer;
		matchCounts = matchCountsBuffer;

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
			matchCounts.push(0);
		}
	}

	return {
		matches,
		indices,
		iterations,
		matchCounts
	};
}

function processKey(key) {
	const lastIdx = key.length - 1,
		ret = {
			key,
			srcKey: key,
			lazy: false,
			strict: false
		};

	switch (key[lastIdx]) {
		case "?":
			ret.key = key.substr(0, lastIdx);
			ret.lazy = true;
			break;
		
		case "!":
			ret.key = key.substr(0, lastIdx);
			ret.strict = true;
			break;
	}

	return ret;
}

const queryTemplates = composeOptionsTemplates({
	smart: true,
	deepEquality: true,
	lazy: true,
	lazySmart: {
		smart: true,
		lazy: true
	}
});
