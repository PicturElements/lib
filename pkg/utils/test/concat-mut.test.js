import concatMut from "../concat-mut";

it("concatenates arrays into with an existing array", () => {
	const arr = [1, 2, 3],
		concatenated = concatMut(arr, [4, 5, 6], [7, 8, 9]);

	expect(concatenated).toBe(arr);
	expect(concatenated).toStrictEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

it("concatenates non-array arguments as individual components", () => {
	expect(concatMut([], 1, 2, [3, 4, 5], 6)).toStrictEqual([1, 2, 3, 4, 5, 6]);
});
