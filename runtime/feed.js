export default function feed(exp, defaultName) {
	if (!exp || typeof exp != "object")
		exp = { default: exp };

	exp = Object.assign({}, exp);

	if (exp.hasOwnProperty("default") && defaultName) {
		if (exp.hasOwnProperty(defaultName))
			console.log(`ERROR: tried to rename default export with '${defaultName}', which is already an export`);
		else
			exp[defaultName] = exp.default;
	}

	console.log("FEED:", exp);

	inject(exp);
}

function inject(exp) {
	for (const k in exp) {
		if (exp.hasOwnProperty(k))
			window[k] = exp[k];
	}
}
