import forEachDeep from "../src/for-each-deep";

const nested = [
		{
			arr: [1, 2, 3],
			arr2: ["a", "b", "c"]
		},
		[
			{
				arr: [1, 2, 3],
				arr2: ["a", "b", "c"]
			},
			4,
			5
		]
	],
	PROPERTY_COUNT = 21;

it("fails silently if the object or callback is invalid", () => {
	expect(_ => forEachDeep(null, _ => _)).not.toThrow();
	expect(_ => forEachDeep({})).not.toThrow();
});

it("iterates over all properties in nested arrays and objects", () => {
	const callback = jest.fn();
	forEachDeep(nested, callback);
	expect(callback.mock.calls.length).toBe(PROPERTY_COUNT);
});

it("accepts options", () => {
	const map = [];
	forEachDeep([1, 2, [3, 4]], v => map.push(v), "reverse");
	expect(map).toStrictEqual([[3, 4], 4, 3, 2, 1]);
});

it("runs the callback function with the correct arguments", () => {
	forEachDeep(nested, (val, k, obj, ...rest) => {
		expect(rest).toStrictEqual([]);
		expect(obj[k]).toBe(val);
	});
});
