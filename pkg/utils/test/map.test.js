import map from "../map";

it("corectly maps", () => {
	const m = map([1, 2, 3], v => v * 2);
	expect(m).toStrictEqual([2, 4, 6]);
});

it("accepts a target object", () => {
	const targ = {},
		out = map([1, 2, 3], v => v, null, targ);

	expect(out).toBe(targ);
	expect(out).toStrictEqual({
		"0": 1,
		"1": 2,
		"2": 3
	});
});

it("returns a blank object or array-like if no valid callback is given", () => {
	expect(map([1, 2, 3])).toStrictEqual([]);
	expect(map({ a: 1, b: 2, c: 3 })).toStrictEqual({});
});

it("accepts options", () => {
	const m = map([1, 2, 3], v => v * 2, "reverse");
	expect(m).toStrictEqual([6, 4, 2]);
});

it("runs the callback function with the correct arguments", () => {
	map([1, 2, 3], (val, k, obj, ...rest) => {
		expect(rest).toStrictEqual([]);
		expect(obj[k]).toBe(val);
	});
});
