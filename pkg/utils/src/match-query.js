import parsePropStr from "./parse-prop-str";
import matchValue from "./match-value";
import matchType from "./match-type";
import { isObj } from "./is";
import {
	composeOptionsTemplates,
	createOptionsObject
} from "./options";
import hasOwn from "./has-own";

export default function matchQuery(val, q, options) {
	options = createOptionsObject(options, optionsTemplates);

	if (!isObj(val) || !isObj(q))
		return false;

	const guard = typeof options.guard == "function" ? options.guard : null;
	let matchCount = 0,
		queryCount = 0;

	for (const k in q) {
		if (!hasOwn(q, k) || options.noNullish && q[k] == null)
			continue;

		const parsedQueryKey = parsePropStr(k);

		if (guard && !guard(parsedQueryKey, val, q))
			continue;

		let {
			key,
			srcKey,
			lazy,
			strict,
			typeModifier
		} = parsedQueryKey;

		lazy = (options.lazy && !strict) || (!options.lazy && lazy);

		const typed = options.typed ^ typeModifier;
		let match;

		if (isObj(q[srcKey]) && options.deep)
			match = matchQuery(val[key], q[srcKey], options);
		else {
			match = typed ?
				matchType(val[key], q[srcKey], options) :
				matchValue(val[key], q[srcKey], options);
		}

		if (!lazy && !match)
			return false;

		if (match)
			matchCount++;

		queryCount++;
	}

	return !queryCount || !!matchCount;
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
	// For matchQuery
	deep: true,
	lazy: true,
	typed: true,
	noNullish: true
});
