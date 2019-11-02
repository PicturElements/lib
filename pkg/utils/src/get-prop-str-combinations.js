// Important: keep up to date with parse-prop-str

import combine from "./combine";

const affixes = combine([
	["", "@"],		// prefix: typing
	["", "!", "?"]	// postfix: strict, lazy
]);

const variationsCache = {};

export default function getPropStrVariations(key) {
	if (variationsCache.hasOwnProperty(key))
		return variationsCache[key];

	const variations = [];

	for (let i = 0, l = affixes.length; i < l; i++)
		variations.push(affixes[i][0] + key + affixes[i][1]);

	variationsCache[key] = variations;
	return variations;
}
