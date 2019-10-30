import parsePropStr from "./parse-prop-str";
import matchValue from "./match-value";
import matchType from "./match-type";
import {
	isObj,
	isArrayLike
} from "./is";
import {
	composeOptionsTemplates,
	createOptionsObject
} from "./options";
import { coerceToObj } from "./coerce";
import hasOwn from "./has-own";

export default function matchQuery(value, query, options) {
	options = createOptionsObject(options, optionsTemplates);
	const guard = typeof options.guard == "function" ? options.guard : null,
		guardMatch = typeof hasOwn(options, "guardMatch") ? options.guardMatch : true,
		nullishMatch = typeof hasOwn(options, "nullishMatch") ? options.nullishMatch : true;

	function match(v, q, matchMap) {
		if (!isObj(v) || !isObj(q))
			return false;

		let matchCount = 0,
			queryCount = 0;

		if (Array.isArray(q)) {
			for (let i = 0, l = q.length; i < l; i++) {
				let qVal = q[i];

				if (options.noNullish && qVal == null) {
					matchMap[i] = nullishMatch;
					continue;
				}

				let parsedQueryKey;

				if (typeof qVal == "string") {
					parsedQueryKey = parsePropStr(qVal);
					qVal = parsedQueryKey.key;
				} else
					parsedQueryKey = parsePropStr("");

				parsedQueryKey.key = i;
				parsedQueryKey.srcKey = i;

				if (guard && !guard(parsedQueryKey, v, q)) {
					matchMap[i] = guardMatch;
					continue;
				}

				let {
					key,
					srcKey,
					lazy,
					strict,
					typeModifier
				} = parsedQueryKey;

				lazy = (options.lazy && !strict) || (!options.lazy && lazy);

				const typed = options.typed ^ typeModifier;
				let matched;

				if (isObj(qVal) && options.deep) {
					if (Array.isArray(qVal) != isArrayLike(v[i]))
						matched = false;
					else if (matchMap) {
						matchMap[i] = coerceToObj(null, q[srcKey]);
						matched = match(v[i], q[srcKey], matchMap[i]);
					} else
						matched = match(v[i], q[srcKey]);
				} else {
					matched = typed ?
						matchType(v[i], qVal, options) :
						matchValue(v[i], qVal, options);

					if (matchMap)
						matchMap[i] = options.logReturnedMatch ? lazy || matched : matched;
				}
				
				if (!lazy && !matched)
					return false;

				if (matched)
					matchCount++;

				queryCount++;
			}
		} else {
			const visitedKeys = {};

			for (const k in q) {
				if (!hasOwn(q, k))
					continue;
				
				if (options.noNullish && q[k] == null) {
					matchMap[k] = nullishMatch;
					continue;
				}

				const parsedQueryKey = parsePropStr(k);

				if (guard && !guard(parsedQueryKey, v, q)) {
					matchMap[k] = guardMatch;
					continue;
				}

				let {
					key,
					srcKey,
					lazy,
					strict,
					typeModifier
				} = parsedQueryKey;

				if (visitedKeys[key]) {
					console.warn(`Warning: key "${key}" has already been declared in this query object (as "${visitedKeys[key]}")`);
					return false;
				}

				visitedKeys[key] = srcKey;

				lazy = (options.lazy && !strict) || (!options.lazy && lazy);

				const typed = options.typed ^ typeModifier;
				let matched;

				if (isObj(q[srcKey]) && options.deep) {
					if (Array.isArray(q[srcKey]) != isArrayLike(v[key]))
						matched = false;
					else if (matchMap) {
						matchMap[key] = coerceToObj(null, q[srcKey]);
						matched = match(v[key], q[srcKey], matchMap[key]);
					} else
						matched = match(v[key], q[srcKey]);
				} else {
					matched = typed ?
						matchType(v[key], q[srcKey], options) :
						matchValue(v[key], q[srcKey], options);

					if (matchMap)
						matchMap[key] = options.logReturnedMatch ? lazy || matched : matched;
				}

				if (!lazy && !matched)
					return false;

				if (matched)
					matchCount++;

				queryCount++;
			}
		}

		return !queryCount || !!matchCount;
	}

	if (options.returnMatchMap) {
		const matchMap = coerceToObj(null, query),
			matched = match(value, query, matchMap);

		return {
			matched,
			matchMap
		};
	} else
		return match(value, query);
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
	noNullish: true,
	logReturnedMatch: true,
	returnMatchMap: true
});
