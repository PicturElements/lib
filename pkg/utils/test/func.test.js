import {
	call,
	apply,
	deepBind
} from "../func";

describe("call", () => {
	it("calls the function with the bound context value", () => {
		const func = jest.fn().mockReturnThis();
		expect(call(func)).toBe(this);

		const ctx = {},
			callBound = call.bind(ctx);
		expect(callBound(func)).toBe(ctx);
		expect(call.call(ctx, func)).toBe(ctx);
	});

	it("calls the function with all required arguments", () => {
		const func = (...args) => args.reduce((sum, v) => sum + v);
		expect(call(func, 1, 2, 3)).toBe(6);
	});
});

describe("apply", () => {
	it("calls the function with the supplied context value", () => {
		const func = jest.fn().mockReturnThis(),
			ctx = {};

		expect(apply(ctx, func)).toBe(ctx);
	});

	it("calls the function with all required arguments", () => {
		const func = (...args) => args.reduce((sum, v) => sum + v);
		expect(apply(null, func, 1, 2, 3)).toBe(6);
	});
});

describe("deepBind", () => {
	it("correctly binds the supplied context value to every function", () => {
		const ctx = {},
			struct = {
				first: jest.fn().mockReturnThis(),
				arr: [
					jest.fn().mockReturnThis()
				],
				obj: {
					second: jest.fn().mockReturnThis()
				}
			};

		deepBind(struct, ctx);

		expect(struct.first()).toBe(ctx);
		expect(struct.arr[0]()).toBe(ctx);
		expect(struct.obj.second()).toBe(ctx);
	});
});
