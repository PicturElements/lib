import {
	binarySearch,
	binaryIndexOf,
	binaryHas,
	binaryFind,
	findClosest,
} from "../binary-search";

const ARR_LEN = 5000,
	ARR_SAMPLES = ARR_LEN * 10,
	MAX_STEPS = Math.ceil(Math.log2(ARR_LEN)),
	SMALL_ARR_LEN = 11,
	SMALL_ARR = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
	SMALL_ARR_DISJOINT = [-Infinity, -1e8, -1e3, -100, -1, 0.25, 0.5, 2.9999, 10.2, 15, Infinity],
	SMALL_STR_ARR = ["0", "1", "10", "2", "3", "4", "5", "6", "7", "8", "9"],
	SMALL_STR_ARR_DISJOINT = ["0.1", "1.55", "10 is a number", "2e0", "3test", "4test", "5test", "68", "79", "899", "9/10"],
	ARR = Array(ARR_LEN).fill(1).map((_, i) => i),
	ARR_REVERSED = ARR.slice().reverse(),
	OVERFLOW = ARR_LEN,
	UNDERFLOW = -1;

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
					idx = binarySearch(ARR, v => v - frac);
		
				expect(idx).toBe(Math.floor(frac));
			}
		});
		
		test("in a reversed integer array", () => {
			for (let i = 0; i < ARR_SAMPLES; i++) {
				const frac = i * ARR_LEN / ARR_SAMPLES,
					idx = binarySearch(ARR_REVERSED, v => v - frac, true);
		
				expect(idx).toBe(ARR_LEN - 1 - Math.floor(frac));
			}
		});
	});

	describe("correctly handles out of bounds values", () => {
		test("in an integer array", () => {
			expect(binarySearch(ARR, v => v - OVERFLOW)).toBe(ARR_LEN - 1);
			expect(binarySearch(ARR, v => v - UNDERFLOW)).toBe(UNDERFLOW);
		});

		test("in a reversed integer array", () => {
			expect(binarySearch(ARR_REVERSED, v => v - OVERFLOW, true)).toBe(0);
			expect(binarySearch(ARR_REVERSED, v => v - UNDERFLOW, true)).toBe(OVERFLOW);
		});
	});
});

describe("binaryIndexOf", () => {
	it("finds the correct index in a small integer array", () => {
		for (let i = 0; i < SMALL_ARR_LEN; i++)
			expect(binaryIndexOf(SMALL_ARR, i)).toBe(i);
	});

	it("finds the correct index in a small string array", () => {
		for (let i = 0; i < SMALL_ARR_LEN; i++) {
			const str = String(i);
			expect(binaryIndexOf(SMALL_STR_ARR, str)).toBe(SMALL_STR_ARR.indexOf(str));
		}
	});

	it("doesn't find disjoint elements from a small integer array", () => {
		for (let i = 0; i < SMALL_ARR_LEN; i++)
			expect(binaryIndexOf(SMALL_ARR, SMALL_ARR_DISJOINT[i])).toBe(-1);
	});

	it("doesn't find disjoint elements from a small string array", () => {
		for (let i = 0; i < SMALL_ARR_LEN; i++)
			expect(binaryIndexOf(SMALL_STR_ARR, SMALL_STR_ARR_DISJOINT[i])).toBe(-1);
	});

	it("allows use of function comparators", () => {
		for (let i = 0; i < SMALL_ARR_LEN; i++)
			expect(binaryIndexOf(SMALL_ARR, v => v - i)).toBe(i);
	});
});

test("binaryHas", () => {
	for (let i = 0; i < SMALL_ARR_LEN; i++)
		expect(binaryHas(SMALL_ARR, i)).toBe(true);
});

test("binaryFind", () => {
	for (let i = 0; i < SMALL_ARR_LEN; i++)
		expect(binaryFind(SMALL_ARR, i)).toBe(i);
	
	expect(binaryFind(SMALL_ARR, -1)).toBe(null);
});

describe("findClosest", () => {
	describe("correctly rounding up when the decimal is between two items", () => {
		test("in an integer array", () => {
			for (let i = 1; i < ARR_LEN; i++) {
				const proximity = findClosest(ARR, v => v - (i - 0.5)).proximity;
				expect(proximity).toBe(0.5);
			}
		});
		
		test("in a reversed integer array", () => {
			for (let i = 1; i < ARR_LEN; i++) {
				const proximity = findClosest(ARR_REVERSED, v => v - (i - 0.5), {reverse: true}).proximity;
				expect(proximity).toBe(0.5);
			}
		});
	});
	
	it("correctly calculates proximity regardless of array direction", () => {
		for (let i = 0; i < ARR_SAMPLES; i++) {
			const frac = i * ARR_LEN / ARR_SAMPLES,
				foundForwards = findClosest(ARR, v => v - frac),
				foundBackwards = findClosest(ARR_REVERSED, v => v - frac, {reverse: true});
	
			expect(foundForwards.proximity).toBe(foundBackwards.proximity);
		}
	
		return;
	});

	it("returns early when the correct hintIndex is provided", () => {
		expect(findClosest(SMALL_ARR, 2, {
			hintIndex: 2
		})).toStrictEqual({
			found: true,
			item: 2,
			index: 2,
			proximity: 0,
			exact: true,
			steps: 0
		});
	});

	it("sets pivot to hintIndex if the initial hint was wrong", () => {
		const stepsDefault = findClosest(ARR, ARR_LEN - 1).steps,
			stepsHinted = findClosest(ARR, ARR_LEN - 1, {
				hintIndex: ARR_LEN - 10
			}).steps;

		expect(stepsHinted).not.toBe(0);
		expect(stepsHinted).toBeLessThan(stepsDefault);
	});
	
	it("doesn't take more than the hypothetical amount of steps to find value", () => {
		for (let i = 1; i < ARR_LEN; i++)
			expect(findClosest(ARR, v => v - (i - 0.5)).steps).toBeLessThanOrEqual(MAX_STEPS);
	});

	describe("returns error objects for out of bounds matches for applicable options", () => {
		test("true positives", () => {
			expect(findClosest(ARR, v => v - UNDERFLOW, { lower: true }).found).toBe(false);
			expect(findClosest(ARR, v => v - OVERFLOW, { upper: true }).found).toBe(false);
			expect(findClosest(ARR_REVERSED, v => v - UNDERFLOW, { lower: true, reverse: true }).found).toBe(false);
			expect(findClosest(ARR_REVERSED, v => v - OVERFLOW, { upper: true, reverse: true }).found).toBe(false);
		});
		
		test("true positives with both bounds", () => {
			expect(findClosest(ARR, v => v - UNDERFLOW, { upper: true, lower: true }).found).toBe(false);
			expect(findClosest(ARR, v => v - OVERFLOW, { upper: true, lower: true }).found).toBe(false);
			expect(findClosest(ARR_REVERSED, v => v - UNDERFLOW, { upper: true, lower: true, reverse: true }).found).toBe(false);
			expect(findClosest(ARR_REVERSED, v => v - OVERFLOW, { upper: true, lower: true, reverse: true }).found).toBe(false);
		});
		
		test("true negatives with one bound", () => {
			expect(findClosest(ARR, v => v - UNDERFLOW, { upper: true }).found).toBe(true);
			expect(findClosest(ARR, v => v - OVERFLOW, { lower: true }).found).toBe(true);
			expect(findClosest(ARR_REVERSED, v => v - UNDERFLOW, { upper: true, reverse: true }).found).toBe(true);
			expect(findClosest(ARR_REVERSED, v => v - OVERFLOW, { lower: true, reverse: true }).found).toBe(true);
		});
		
		test("true negatives with no bounds", () => {
			expect(findClosest(ARR, v => v - UNDERFLOW).found).toBe(true);
			expect(findClosest(ARR, v => v - OVERFLOW).found).toBe(true);
			expect(findClosest(ARR_REVERSED, v => v - UNDERFLOW, { reverse: true }).found).toBe(true);
			expect(findClosest(ARR_REVERSED, v => v - OVERFLOW, { reverse: true }).found).toBe(true);
		});
	});
	
	it("returns an error object when no array is supplied or the array is empty", () => {
		expect(findClosest(null).found).toBe(false);
		expect(findClosest([]).found).toBe(false);
	});
});
