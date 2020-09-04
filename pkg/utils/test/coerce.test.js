import {
	coerceObj,
	coerceObjArrResolvable,
	coerceNum
} from "../src/coerce";

describe("coerceObj", () => {
	const obj = {},
		arr = [];

	it("ignores the source if the input data is an object", () => {
		expect(coerceObj(obj, [])).toBe(obj);
		expect(coerceObj(arr, {})).toBe(arr);
		expect(coerceObj(obj, null)).toBe(obj);
		expect(coerceObj(arr, null)).toBe(arr);
	});

	it("creates a new object of the correct type from the source object", () => {
		expect(coerceObj(null, [])).toStrictEqual([]);
		expect(coerceObj(null, {})).toStrictEqual({});
	});

	it("creates a new plain object if no appropriate arguments are supplied", () => {
		expect(coerceObj(null, null)).toStrictEqual({});
	});
});

describe("coerceObjArrResolvable", () => {
	const obj = {},
		arr = [];

	it("ignores the source if the input data is an object", () => {
		expect(coerceObjArrResolvable(obj, [])).toBe(obj);
		expect(coerceObjArrResolvable(arr, {})).toBe(arr);
		expect(coerceObjArrResolvable(obj, null)).toBe(obj);
		expect(coerceObjArrResolvable(arr, null)).toBe(arr);
	});

	it("creates a new object of the correct type from the source object", () => {
		expect(coerceObjArrResolvable(null, new Set())).toStrictEqual([]);
		expect(coerceObjArrResolvable(null, [])).toStrictEqual([]);
		expect(coerceObjArrResolvable(null, {})).toStrictEqual({});
	});

	it("creates a new plain object if no appropriate arguments are supplied", () => {
		expect(coerceObjArrResolvable(null, null)).toStrictEqual({});
	});
});

describe("coerceNum", () => {
	it("ignores the default value if the input is not NaN", () => {
		expect(coerceNum(1, 2)).toBe(1);
		expect(coerceNum(-Infinity, 0)).toBe(-Infinity);
		expect(coerceNum(Infinity, 0)).toBe(Infinity);
	});

	it("uses the default value if the input is NaN", () => {
		expect(coerceNum("not a number", 0)).toBe(0);
		expect(coerceNum({}, 0)).toBe(0);
	});
});
