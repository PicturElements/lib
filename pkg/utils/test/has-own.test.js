import hasOwn from "../src/has-own";
import { POLYFILL_PREFIXES } from "../src/data/constants";

const OBJ = {
	a: 1,
	b: 2,
	[Symbol.for("c")]: 3,
	[`${POLYFILL_PREFIXES.symbol}sym`]: 12
};

it("matches own properties only", () => {
	const set = new Set();
	expect(set.size == 0 && !hasOwn(set, "size"));
});

it("matches string property keys but not symbol keys if allowSymbols is set to false", () => {
	expect(hasOwn(OBJ, "a")).toBe(true);
	expect(hasOwn.polyfill(OBJ, "a")).toBe(true);
	expect(hasOwn(OBJ, Symbol.for("c"), false)).toBe(false);
	expect(hasOwn.polyfill(OBJ, `${POLYFILL_PREFIXES.symbol}sym`, false)).toBe(false);
});

it("matches string symbol keys with allowSymbol flag", () => {
	expect(hasOwn(OBJ, Symbol.for("c"), true)).toBe(true);
	expect(hasOwn.polyfill(OBJ, `${POLYFILL_PREFIXES.symbol}sym`, true)).toBe(true);
});
