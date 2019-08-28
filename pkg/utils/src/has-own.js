import { polyfillPrefixes } from "./_constants";

const oHOP = Object.prototype.hasOwnProperty;

// Polyfill aware hasOwnProperty
// By default it doesn't count symbol keys as valid own property keys
// so to enable that please use the allowSymbols flag

const polyfillHasOwn = (obj, k, allowSymbols) => {
	if (!oHOP.call(obj, k))
		return false;
	
	if (allowSymbols || k[0] != "@")
		return true;

	return k.indexOf(polyfillPrefixes.symbol) != 0;
};

const defaultHasOwn = (obj, k, allowSymbols) => {
	if (!oHOP.call(obj, k))
		return false;

	return !!allowSymbols || typeof k != "symbol";
};

const hasOwn = typeof Symbol == "undefined" ? polyfillHasOwn : defaultHasOwn;
hasOwn.polyfill = polyfillHasOwn;

export default hasOwn;
