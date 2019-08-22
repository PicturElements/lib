import filterMut from "../filter-mut";

it("removes interspersed values from an array", () => {
	const arr = [2, 1, 3, 1, 1, 1, 4, 5, 6, 1, 1, 7, 1, 8, 9, 1, 1, 1],
		filtered = filterMut(arr, v => v != 1);

	expect(filtered).toBe(arr);
	expect(filtered).toStrictEqual([2, 3, 4, 5, 6, 7, 8, 9]);
	expect(filterMut([1, 2, 3], v => v != 0)).toStrictEqual([1, 2, 3]);
});

it("runs the callback function with the correct arguments", () => {
	const arr = [1, 1, 2, 1, 3, 1, 1, 4];

	filterMut(arr, (val, idx, a, ...rest) => {
		expect(rest).toStrictEqual([]);
		expect(typeof val).toBe("number");
		expect(typeof idx).toBe("number");
		expect(a).toBe(arr);
		expect(a[idx]).toBe(val);
	});
});
