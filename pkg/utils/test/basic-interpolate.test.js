import basicInterpolate from "../basic-interpolate";

const DATA = {
	num: 42,
	obj: {
		str: "string"
	},
	arr: [
		false,
		NaN,
		undefined,
		null
	]
};

it("interpolates multiple items in a single string", () => {
	expect(basicInterpolate("$num == $num", DATA)).toBe("42 == 42");
});

it("correctly handles nested data", () => {
	expect(basicInterpolate("This is a $obj.str", DATA)).toBe("This is a string");
});

it("keeps the original data reference for nonexistent accessor if no default value is supplied", () => {
	expect(basicInterpolate("$nothing", DATA)).toBe("$nothing");
});

describe("correctly inserts default data", () => {
	test("with a static value", () => {
		expect(basicInterpolate("$nothing", DATA, 42)).toBe("42");
	});

	test("with a value resolver", () => {
		expect(basicInterpolate("$nothing", DATA, accessor => {
			return `I failed at $${accessor}`;
		})).toBe("I failed at $nothing");
	});
});

it("correctly inserts falsy values", () => {
	expect(basicInterpolate("$arr[0]", DATA)).toBe("false");
	expect(basicInterpolate("$arr[1]", DATA)).toBe("NaN");
	expect(basicInterpolate("$arr[2]", DATA)).toBe("undefined");
	expect(basicInterpolate("$arr[3]", DATA)).toBe("null");
});

it("returns an empty string in the input is not a string", () => {
	expect(basicInterpolate(null)).toBe("");
	expect(basicInterpolate({})).toBe("");
	expect(basicInterpolate(12345)).toBe("");
});
