// Important: keep up to date with parse-prop-str
import combine from "./combine";
import hasOwn from "./has-own";

const AFFIXES = combine([
	["", "@"],		// prefix: typing
	["", "!", "?"]	// postfix: strict, lazy
]);

const VARIATIONS_CACHE = {};

export default function getPropStrVariations(key) {
	if (hasOwn(VARIATIONS_CACHE, key))
		return VARIATIONS_CACHE[key];

	const variations = [];

	for (let i = 0, l = AFFIXES.length; i < l; i++)
		variations.push(AFFIXES[i][0] + key + AFFIXES[i][1]);

	VARIATIONS_CACHE[key] = variations;
	return variations;
}
