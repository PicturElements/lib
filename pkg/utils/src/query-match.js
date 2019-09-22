import parsePropStr from "./parse-prop-str";
import propMatch from "./prop-match";
import { isObj } from "./is";
import {
	composeOptionsTemplates,
	createOptionsObject
} from "./options";
import hasOwn from "./has-own";

export default function queryMatch(item, q, options) {
	options = createOptionsObject(options, queryMatchTemplates);

	if (!isObj(item) || !isObj(q))
		return false;

	const guard = typeof options.guard == "function" ? options.guard : null;
	let matchCount = 0,
		queryCount = 0;

	for (const k in q) {
		if (!hasOwn(q, k) || options.noNullish && q[k] == null)
			continue;

		const parsedQueryKey = parsePropStr(k);

		if (guard && !guard(parsedQueryKey, item, q))
			continue;

		let {
			key,
			srcKey,
			lazy,
			strict
		} = parsedQueryKey;

		lazy = (options.lazy && !strict) || (!options.lazy && lazy);

		const match = propMatch(item[key], q[srcKey], options);

		if (!lazy && !match)
			return false;

		if (match)
			matchCount++;

		queryCount++;
	}

	return !queryCount || !!matchCount;
}

const queryMatchTemplates = composeOptionsTemplates({
	smart: true,
	deepEquality: true,
	lazy: true,
	noNullish: true
});
