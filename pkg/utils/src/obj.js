import hasOwn from "./has-own";

const keys = typeof Symbol == "undefined" ? Object.keys : o => {
	if (o == null)
		throw new TypeError("Cannot convert undefined or null to object");

	const out = [];

	for (let k in o) {
		if (!hasOwn(o, k))
			continue;

		out.push(k);
	}

	return out;
};

export {
	keys
};
