const POLYFILL_PREFIXES = {
	symIterator: "@Polyfill:SymbolIterator",
	symbol: "@Polyfill:Symbol - "
};

const SYM_ITER_KEY = typeof Symbol == "undefined" ?
	POLYFILL_PREFIXES.symIterator :
	Symbol.iterator;

const BASE_62 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const BASE_64 = BASE_62 + "+/";
const BASE_64_YT = BASE_62 + "-_";

export {
	POLYFILL_PREFIXES,
	SYM_ITER_KEY,
	BASE_62,
	BASE_64,
	BASE_64_YT
};
