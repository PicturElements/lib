import {
	binarySearch,
	binaryIndexOf,
	findClosest,
} from "../binary-search";

const ARR_LEN = 5000,
	ARR_SAMPLES = ARR_LEN * 10,
	MAX_STEPS = Math.ceil(Math.log2(ARR_LEN)),
	SMALL_ARR_LEN = 11,
	smallArr = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
	smallArrDisjoint = [-Infinity, -1e8, -1e3, -100, -1, 0.25, 0.5, 2.9999, 10.2, 15, Infinity],
	smallStrArr = ["0", "1", "10", "2", "3", "4", "5", "6", "7", "8", "9"],
	smallStrArrDisjoint = ["0.1", "1.55", "10 is a number", "2e0", "3test", "4test", "5test", "68", "79", "899", "9/10"],
	arr = Array(ARR_LEN).fill(1).map((_, i) => i),
	arrReversed = arr.slice().reverse(),
	overflow = ARR_LEN,
	underflow = -1;

it("creates appropriate default comparators", () => {
	expect(binarySearch([1, 2, 3, 4], 3)).toBe(2);
	expect(binarySearch(["a", "b", "c", "d"], "b")).toBe(1);
	expect(findClosest([1, 2, 3, 4], 3).index).toBe(2);
	expect(findClosest(["a", "b", "c", "d"], "b").index).toBe(1);
});

describe("binarySearch", () => {
	describe("correctly returns an index for a value or the closest value floored", () => {
		test("in an integer array", () => {
			for (let i = 0; i < ARR_SAMPLES; i++) {
				const frac = i * ARR_LEN / ARR_SAMPLES,
					idx = binarySearch(arr, v => v - frac);
		
				expect(idx).toBe(Math.floor(frac));
			}
		});
		
		test("in a reversed integer array", () => {
			for (let i = 0; i < ARR_SAMPLES; i++) {
				const frac = i * ARR_LEN / ARR_SAMPLES,
					idx = binarySearch(arrReversed, v => v - frac, true);
		
				expect(idx).toBe(ARR_LEN - 1 - Math.floor(frac));
			}
		});
	});

	describe("correctly handles out of bounds values", () => {
		test("in an integer array", () => {
			expect(binarySearch(arr, v => v - overflow)).toBe(ARR_LEN - 1);
			expect(binarySearch(arr, v => v - underflow)).toBe(underflow);
		});

		test("in a reversed integer array", () => {
			expect(binarySearch(arrReversed, v => v - overflow, true)).toBe(0);
			expect(binarySearch(arrReversed, v => v - underflow, true)).toBe(overflow);
		});
	});
});

describe("binaryIndexOf", () => {
	it("finds the correct index in a small integer array", () => {
		for (let i = 0; i < SMALL_ARR_LEN; i++)
			expect(binaryIndexOf(smallArr, i)).toBe(i);
	});

	it("finds the correct index in a small string array", () => {
		for (let i = 0; i < SMALL_ARR_LEN; i++) {
			const str = String(i);
			expect(binaryIndexOf(smallStrArr, str)).toBe(smallStrArr.indexOf(str));
		}
	});

	it("doesn't find disjoint elements from a small integer array", () => {
		for (let i = 0; i < SMALL_ARR_LEN; i++)
			expect(binaryIndexOf(smallArr, smallArrDisjoint[i])).toBe(-1);
	});

	it("doesn't find disjoint elements from a small string array", () => {
		for (let i = 0; i < SMALL_ARR_LEN; i++)
			expect(binaryIndexOf(smallStrArr, smallStrArrDisjoint[i])).toBe(-1);
	});
});

describe("findClosest", () => {
	describe("correctly rounding up when the decimal is between two items", () => {
		test("in an integer array", () => {
			for (let i = 1; i < ARR_LEN; i++) {
				const proximity = findClosest(arr, v => v - (i - 0.5)).proximity;
				expect(proximity).toBe(0.5);
			}
		});
		
		test("in a reversed integer array", () => {
			for (let i = 1; i < ARR_LEN; i++) {
				const proximity = findClosest(arrReversed, v => v - (i - 0.5), {reverse: true}).proximity;
				expect(proximity).toBe(0.5);
			}
		});
	});
	
	it("correctly calculates proximity regardless of array direction", () => {
		for (let i = 0; i < ARR_SAMPLES; i++) {
			const frac = i * ARR_LEN / ARR_SAMPLES,
				foundForwards = findClosest(arr, v => v - frac),
				foundBackwards = findClosest(arrReversed, v => v - frac, {reverse: true});
	
			expect(foundForwards.proximity).toBe(foundBackwards.proximity);
		}
	
		return;
	});
	
	it("doesn't take more than the hypothetical amount of steps to find value", () => {
		for (let i = 1; i < ARR_LEN; i++)
			expect(findClosest(arr, v => v - (i - 0.5)).steps).toBeLessThanOrEqual(MAX_STEPS);
	});

	describe("returns error objects for out of bounds matches for applicable options", () => {
		test("true positives", () => {
			expect(findClosest(arr, v => v - underflow, { lower: true }).found).toBe(false);
			expect(findClosest(arr, v => v - overflow, { upper: true }).found).toBe(false);
			expect(findClosest(arrReversed, v => v - underflow, { lower: true, reverse: true }).found).toBe(false);
			expect(findClosest(arrReversed, v => v - overflow, { upper: true, reverse: true }).found).toBe(false);
		});
		
		test("true positives with both bounds", () => {
			expect(findClosest(arr, v => v - underflow, { upper: true, lower: true }).found).toBe(false);
			expect(findClosest(arr, v => v - overflow, { upper: true, lower: true }).found).toBe(false);
			expect(findClosest(arrReversed, v => v - underflow, { upper: true, lower: true, reverse: true }).found).toBe(false);
			expect(findClosest(arrReversed, v => v - overflow, { upper: true, lower: true, reverse: true }).found).toBe(false);
		});
		
		test("true negatives with one bound", () => {
			expect(findClosest(arr, v => v - underflow, { upper: true }).found).toBe(true);
			expect(findClosest(arr, v => v - overflow, { lower: true }).found).toBe(true);
			expect(findClosest(arrReversed, v => v - underflow, { upper: true, reverse: true }).found).toBe(true);
			expect(findClosest(arrReversed, v => v - overflow, { lower: true, reverse: true }).found).toBe(true);
		});
		
		test("true negatives with no bounds", () => {
			expect(findClosest(arr, v => v - underflow).found).toBe(true);
			expect(findClosest(arr, v => v - overflow).found).toBe(true);
			expect(findClosest(arrReversed, v => v - underflow, { reverse: true }).found).toBe(true);
			expect(findClosest(arrReversed, v => v - overflow, { reverse: true }).found).toBe(true);
		});
	});
});
