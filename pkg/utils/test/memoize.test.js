import memoize from "../src/memoize";

describe("displays idempotent properties with identical arguments and returns correct values", () => {
	const summarizer = (...args) => args.reduce((sum, v) => sum + v);

	test("when identical arguments are passed sequentially", () => {
		const func = jest.fn(summarizer);

		for (let i = 1; i < 10; i++)
			expect(memoize(func, 1, 2, 3)).toBe(6);

		expect(func.mock.calls.length).toBe(1);		
	});

	test("when identical arguments are passed intermittently", () => {
		const func = jest.fn(summarizer);

		for (let i = 0; i < 10; i++) {
			for (let j = 0; j < 10; j++)
				expect(memoize(func, 1 * j, 2 * j, 3 * j)).toBe(6 * j);
		}
	});
});

it("produces a reliable hash to distinguish call signatures", () => {
	const func = jest.fn();

	for (let i = 0; i < 10; i++) { 
		memoize(func, null, "null");
		memoize(func, "null", null);
		memoize(func, "null", "null");
		memoize(func, null, null);

		memoize(func, 1, "1");
		memoize(func, "1", 1);
		memoize(func, "1", "1");
		memoize(func, 1, 1);
	}

	expect(func.mock.calls.length).toBe(8);
});

it("doesn't hash functions, objects, or symbols", () => {
	const func = jest.fn();

	for (let i = 0; i < 10; i++) {
		memoize(func, func);
		memoize(func, {});
		memoize(func, Symbol("test"));
	}

	expect(func.mock.calls.length).toBe(30);
});
