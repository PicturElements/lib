import hasOwn from "../has-own";

const OBJ = {
	a: 1,
	b: 2,
	[Symbol.for("c")]: 3,
	"@Polyfill:Symbol - sym": 12
};

it("matches own properties only", () => {
	const set = new Set();
	expect(set.size == 0 && !hasOwn(set, "size"));
});

it("matches string property keys but not symbol keys", () => {
	expect(hasOwn(OBJ, "a")).toBe(true);
	expect(hasOwn.polyfill(OBJ, "a")).toBe(true);
	expect(hasOwn(OBJ, Symbol.for("c"))).toBe(false);
	expect(hasOwn.polyfill(OBJ, "@Polyfill:Symbol - sym")).toBe(false);
});

it("matches string symbol keys with allowSymbol flag", () => {
	expect(hasOwn(OBJ, Symbol.for("c"), true)).toBe(true);
	expect(hasOwn.polyfill(OBJ, "@Polyfill:Symbol - sym", true)).toBe(true);
});
