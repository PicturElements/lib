import {
	coerceToObj,
	coerceToObjArrResolvable,
	coerceNum
} from "../coerce";

describe("coerceToObj", () => {
	const obj = {},
		arr = [];

	it("ignores the source if the input data is an object", () => {
		expect(coerceToObj(obj, [])).toBe(obj);
		expect(coerceToObj(arr, {})).toBe(arr);
		expect(coerceToObj(obj, null)).toBe(obj);
		expect(coerceToObj(arr, null)).toBe(arr);
	});

	it("creates a new object of the correct type from the source object", () => {
		expect(coerceToObj(null, [])).toStrictEqual([]);
		expect(coerceToObj(null, {})).toStrictEqual({});
	});

	it("creates a new plain object if no appropriate arguments are supplied", () => {
		expect(coerceToObj(null, null)).toStrictEqual({});
	});
});

describe("coerceToObjArrResolvable", () => {
	const obj = {},
		arr = [];

	it("ignores the source if the input data is an object", () => {
		expect(coerceToObjArrResolvable(obj, [])).toBe(obj);
		expect(coerceToObjArrResolvable(arr, {})).toBe(arr);
		expect(coerceToObjArrResolvable(obj, null)).toBe(obj);
		expect(coerceToObjArrResolvable(arr, null)).toBe(arr);
	});

	it("creates a new object of the correct type from the source object", () => {
		expect(coerceToObjArrResolvable(null, new Set())).toStrictEqual([]);
		expect(coerceToObjArrResolvable(null, [])).toStrictEqual([]);
		expect(coerceToObjArrResolvable(null, {})).toStrictEqual({});
	});

	it("creates a new plain object if no appropriate arguments are supplied", () => {
		expect(coerceToObjArrResolvable(null, null)).toStrictEqual({});
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
