function resolveVal(val, ...args) {
	if (typeof val == "function")
		return val(...args);

	return val;
}

function resolveValWithPassedFallback(val, fallback, ...args) {
	if (typeof val == "function")
		return val(fallback, ...args);

	return val === undefined ? fallback : val;
}

export {
	resolveVal,
	resolveValWithPassedFallback
};
