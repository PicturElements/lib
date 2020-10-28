import { nub } from "../src/array";

it("correctly nubs arrays", () => {
	expect(nub([1, 2, 3, 1, 2, 4, 5, 6, 3, 5, 7])).toStrictEqual([1, 2, 3, 4, 5, 6, 7]);
	expect(nub([{}, {}])).toStrictEqual([{}, {}]);
	const obj = {};
	expect(nub([obj, "padding", obj])).toStrictEqual([obj, "padding"]);
});
