import { isSymbol } from "./internal/duplicates";
import { POLYFILL_PREFIXES } from "./data/constants";
import hasOwn from "./has-own";

let keySeed = 0;
const NUM_TO_STR = Number.prototype.toString;

function sym(prefix) {
	keySeed += (Math.floor(Math.random() * 1e6) + 1e6);
	const postfix = NUM_TO_STR.call(keySeed, 36),
		key = prefix ?
			`${prefix}:${postfix}` :
			postfix;

	return typeof Symbol == "undefined" ?
		`${POLYFILL_PREFIXES.symbol}${key}` :
		Symbol(key);
}

const setSymbol = typeof Symbol == "undefined" ?
	(obj, symbol, value = null) => {
		if (!isSymbol(symbol))
			return warnSymbolSet(symbol, obj);

		if (hasOwn(obj, symbol))
			obj[symbol] = value;

		Object.defineProperty(obj, symbol, {
			enumerable: false,
			writable: true,
			value: value
		});

		return obj;
	} :
	(obj, symbol, value = null) => {
		if (!isSymbol(symbol))
			return warnSymbolSet(symbol, obj);

		obj[symbol] = value;
	};

function warnSymbolSet(failedSymbol, retVal) {
	console.warn("Failed to use setSymbol: the supplied key is not a symbol", failedSymbol);
	return retVal;
}

export {
	sym,
	setSymbol
};
