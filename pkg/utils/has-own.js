const oHOP = Object.prototype.hasOwnProperty;

// Polyfill aware hasOwnProperty
// By default it doesn't count symbol keys as valid own property keys
// so to enable that please use the allowSymbol flag

const polyfillHasOwn = (obj, k, allowSymbol) => {
	if (!oHOP.call(obj, k))
		return false;
	
	if (allowSymbol || k[0] != "@")
		return true;

	return k.indexOf("@Polyfill:Symbol - ") != 0;
};

const defaultHasOwn = (obj, k, allowSymbol) => {
	if (!oHOP.call(obj, k))
		return false;

	return !!allowSymbol || typeof k != "symbol";
};

const hasOwn = typeof Symbol == "undefined" ? polyfillHasOwn : defaultHasOwn;
hasOwn.polyfill = polyfillHasOwn;

export default hasOwn;
