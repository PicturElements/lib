import parsePropStr from "./parse-prop-str";
import matchValue from "./match-value";
import matchType from "./match-type";
import matchQuery from "./match-query";
import { keys as objKeys } from "./obj";
import {
	isArrayLike,
	isObj
} from "./is";
import {
	composeOptionsTemplates,
	createOptionsObject
} from "./internal/options";

export default function query(list, q, options) {
	options = createOptionsObject(options, optionsTemplates);

	if (!isArrayLike(list) || !q || typeof q != "object") {
		return {
			matches: [],
			indices: [],
			iterations: 0
		};
	}

	const guard = typeof options.guard == "function" ? options.guard : null,
		keys = objKeys(q),
		keyLen = keys.length;

	// Separate arrays are used because
	// mainly this function deals with filtering
	// and wrapping data would be less intuitive
	let matches = [],
		indices = [],
		matchCounts = [],
		iterations = 0;

	for (let i = 0; i < keyLen; i++) {
		if (options.noNullish && q[keys[i]] == null)
			continue;

		const parsedQueryKey = parsePropStr(keys[i]);

		let {
			key,
			srcKey,
			lazy,
			strict,
			typeModifier
		} = parsedQueryKey;

		lazy = (options.lazy && !strict) || (!options.lazy && lazy);

		const typed = options.typed ^ typeModifier,
			srcArr = iterations ? matches : list,
			matchesBuffer = [],
			indicesBuffer = [],
			matchCountsBuffer = [];

		for (let j = 0, l2 = srcArr.length; j < l2; j++) {
			const val = srcArr[j],
				idx = indices[j] || j,
				matchCount = matchCounts[j] || 0,
				guardPass = guard && !guard(parsedQueryKey, q, val);
			let match;

			if (!val)
				match = false;
			else if (isObj(q[srcKey]) && options.deep)
				match = matchQuery(val[key], q[srcKey], options);
			else {
				match = typed ?
					matchType(val[key], q[srcKey], options) :
					matchValue(val[key], q[srcKey], options);
			}

			// If the last key has been reached and there's no match,
			// there there can be no matched result even with lazy
			// matching if there have been no previous matches
			if (match || (lazy || guardPass) && (matchCount || i < keyLen - 1)) {
				matchesBuffer.push(val);
				indicesBuffer.push(idx);
				matchCountsBuffer.push(matchCount + Number(match));
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

	if (options.bundle) {
		const out = [];

		for (let i = 0, l = matches.length; i < l; i++) {
			out.push({
				match: matches[i],
				matchCount: matchCounts[i]
			});
		}

		return out;
	}

	return {
		matches,
		indices,
		iterations,
		matchCounts
	};
}

const optionsTemplates = composeOptionsTemplates({
	// For matchValue
	plain: true,
	deepEquality: true,
	// For matchType
	strictConstructor: true,
	noStrictConstructor: {
		strictConstructor: false
	},
	falseDefault: {
		defaultMatch: false
	},
	trueDefault: {
		defaultMatch: true
	},
	// For query
	deep: true,
	lazy: true,
	typed: true,
	bundle: true,
	noNullish: true
});
