import equals from "../src/equals";

it("correctly compares primitives", () => {
	expect(equals()).toBe(true);
	expect(equals(1, 1)).toBe(true);
	expect(equals(NaN, NaN)).toBe(true);
	expect(equals(0, -0)).toBe(true);
	expect(equals("abc", "abc")).toBe(true);
	expect(equals(Symbol.for("sym"), Symbol.for("sym"))).toBe(true);

	expect(equals(null)).toBe(false);
	expect(equals("abc", "abcd")).toBe(false);
});

it("correctly compares objects", () => {
	expect(equals([], [])).toBe(true);
	expect(equals([1, "abc"], [1, "abc"])).toBe(true);
	expect(equals({
		a: 1,
		b: 2
	}, {
		b: 2,
		a: 1
	})).toBe(true);

	expect(equals([1, "abc"], ["abc", 1])).toBe(false);
	expect(equals({
		a: 1,
		b: 2
	}, {
		a: 1,
		b: 2,
		c: 3
	})).toBe(false);
	expect(equals({
		a: 1,
		b: 2,
		c: 3
	}, {
		a: 1,
		b: 2
	})).toBe(false);
});

it("supports lazy option", () => {
	expect(equals({
		a: 1,
		b: 2
	}, {
		a: 1,
		b: 2,
		c: 3
	}, "lazy")).toBe(true);
});

it("correctly compares nested objects", () => {
	expect(equals({
		a: NaN,
		b: [1, 2, "abc", true, Symbol.for("sym")],
		c: {
			d: null,
			e: undefined
		}
	}, {
		b: [1, 2, "abc", true, Symbol.for("sym")],
		a: NaN,
		c: {
			d: null,
			e: undefined
		}
	})).toBe(true);
});
