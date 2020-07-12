/* eslint-disable no-prototype-builtins */

export default function feed(exp, defaultName) {
	if (!exp || typeof exp != "object")
		exp = { default: exp };

	injectAll(exp);

	if (exp.hasOwnProperty("default") && defaultName)
		inject(defaultName, exp.default);
	
	inject("example", runExample);
	inject("feed", feed.activeFeed);

	console.log("FEED:", feed.activeFeed);
}

feed.activeFeed = {};
feed.examples = {};

feed.add = (key, applier) => {
	inject(key, applier(feed.activeFeed));
};

feed.example = (key, config) => {
	feed.examples[key] = config;
};

// ==================================================================

function injectAll(exp) {
	for (const k in exp) {
		if (exp.hasOwnProperty(k))
			inject(k, exp[k]);
	}
}

function inject(key, value) {
	if (feed.activeFeed.hasOwnProperty(key))
		console.warn(`Overwrote '${key}'`);

	feed.activeFeed[key] = value;
	window[key] = value;
}

function runExample(key) {
	if (!feed.examples.hasOwnProperty(key))
		return console.error(`Feed doesn't include an example by name '${key}'`);

	const config = feed.examples[key];

	return config.handler(feed.activeFeed);
}
