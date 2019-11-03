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
import mkAccessor from "./mk-accessor";

export default function matchQuery(value, query, options) {
	options = createOptionsObject(options, optionsTemplates);
	const guard = typeof options.guard == "function" ? options.guard : null,
		guardMatch = typeof hasOwn(options, "guardMatch") ? options.guardMatch : true,
		nullishMatch = typeof hasOwn(options, "nullishMatch") ? options.nullishMatch : true;

	function match(v, q, matchRuntime) {
		if (!isObj(v) || !isObj(q))
			return false;

		let matchCount = 0,
			queryCount = 0;

		if (Array.isArray(q)) {
			for (let i = 0, l = q.length; i < l; i++) {
				let qVal = q[i];

				if (options.noNullish && qVal == null) {
					if (matchRuntime)
						matchRuntime.matchMap[i] = nullishMatch;

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
					if (matchRuntime)
						matchRuntime.matchMap[i] = guardMatch;

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
					else if (matchRuntime) {
						matchRuntime.matchMap[i] = coerceToObj(null, q[srcKey]);
						matchRuntime.matchMap = matchRuntime.matchMap[i];
						matchRuntime.accessor.push(srcKey);
						matched = match(v[i], q[srcKey], matchRuntime);
						matchRuntime.accessor.pop();
					} else
						matched = match(v[i], q[srcKey]);
				} else {
					matched = typed ?
						matchType(v[i], qVal, options) :
						matchValue(v[i], qVal, options);

					if (matchRuntime)
						matchRuntime.matchMap[i] = options.logReturnedMatch ? lazy || matched : matched;
				}
				
				if (!lazy && !matched) {
					if (options.throwOnStrictMismatch && strict) {
						if (matchRuntime)
							throw new Error(`${i} is a required index (at ${mkAccessor(matchRuntime.accessor)})`);
						
						throw new Error(`${i} is a required index`);
					}

					if (matchRuntime)
						continue;
					else
						return false;
				}

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
					if (matchRuntime)
						matchRuntime.matchMap[k] = nullishMatch;

					continue;
				}

				const parsedQueryKey = parsePropStr(k);

				if (guard && !guard(parsedQueryKey, v, q)) {
					if (matchRuntime)
						matchRuntime.matchMap[k] = guardMatch;

					continue;
				}

				let {
					key,
					srcKey,
					lazy,
					strict,
					typeModifier
				} = parsedQueryKey;

				if (visitedKeys.hasOwnProperty(key))
					throw new Error(`Key '${key}' has already been declared on this query object (as '${visitedKeys[key]}', at ${mkAccessor(matchRuntime.accessor)})`);

				visitedKeys[key] = srcKey;

				lazy = (options.lazy && !strict) || (!options.lazy && lazy);

				const typed = options.typed ^ typeModifier;
				let matched;

				if (isObj(q[srcKey]) && options.deep) {
					if (Array.isArray(q[srcKey]) != isArrayLike(v[key]))
						matched = false;
					else if (matchRuntime) {
						matchRuntime.matchMap[key] = coerceToObj(null, q[srcKey]);
						matchRuntime.matchMap = matchRuntime.matchMap[key];
						matchRuntime.accessor.push(srcKey);
						matched = match(v[key], q[srcKey], matchRuntime);
						matchRuntime.accessor.pop();
					} else
						matched = match(v[key], q[srcKey]);
				} else {
					matched = typed ?
						matchType(v[key], q[srcKey], options) :
						matchValue(v[key], q[srcKey], options);

					if (matchRuntime)
						matchRuntime.matchMap[key] = options.logReturnedMatch ? lazy || matched : matched;
				}

				if (!lazy && !matched) {
					if (options.throwOnStrictMismatch && strict) {
						if (matchRuntime)
							throw new Error(`${key} is a required property (at ${mkAccessor(matchRuntime.accessor)})`);
						
						throw new Error(`${key} is a required property`);
					}

					if (matchRuntime)
						continue;
					else
						return false;
				}

				if (matched)
					matchCount++;

				queryCount++;
			}
		}

		return !queryCount || !!matchCount;
	}

	if (options.returnMatchMap) {
		const rootMatchMap = coerceToObj(null, query),
			matchRuntime = {
				matchMap: rootMatchMap,
				rootMatchMap,
				accessor: []
			},	
			matched = match(value, query, matchRuntime);

		return {
			matched,
			matchMap: matchRuntime.rootMatchMap
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
	returnMatchMap: true,
	throwOnStrictMismatch: true
});
