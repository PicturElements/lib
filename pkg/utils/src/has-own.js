import { POLYFILL_PREFIXES } from "./internal/constants";

const oHOP = Object.prototype.hasOwnProperty;

const polyfillHasOwn = (obj, k, allowSymbols = true) => {
	if (!oHOP.call(obj, k))
		return false;

	if (allowSymbols || k[0] != "@")
		return true;

	return k.indexOf(POLYFILL_PREFIXES.symbol) != 0;
};

const defaultHasOwn = (obj, k, allowSymbols = true) => {
	if (!oHOP.call(obj, k))
		return false;

	return !!allowSymbols || typeof k != "symbol";
};

const hasOwn = typeof Symbol == "undefined" ? polyfillHasOwn : defaultHasOwn;
hasOwn.polyfill = polyfillHasOwn;

export default hasOwn;
