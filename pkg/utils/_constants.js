const polyfillPrefixes = {
	symIterator: "@Polyfill:SymbolIterator",
	symbol: "@Polyfill:Symbol - "
};

const symbolIteratorKey = typeof Symbol == "undefined" ? polyfillPrefixes.symIterator : Symbol.iterator;

export {
	symbolIteratorKey,
	polyfillPrefixes
};
