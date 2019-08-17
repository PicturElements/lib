import {
	round,
	roundCustom,
	numLen,
	isPowerOf2,
	isPowerOf2i64
} from "../num";

test("round", () => {
	expect(round(0)).toBe(0);
	expect(round(0.1234)).toBe(0.12);
	expect(round(0.12345, 4)).toBe(0.1235);
	expect(round(1000000.12345, 4)).toBe(1000000.1235);
	expect(round(-14.2453)).toBe(-14.25);
});

test("roundCustom", () => {
	expect(roundCustom(15, 10)).toBe(20);
	expect(roundCustom(15.345, 0.01)).toBe(15.35);
	expect(roundCustom(15, 20)).toBe(20);
	expect(roundCustom(-15, 20)).toBe(-20);
	expect(roundCustom(-14, 10)).toBe(-10);
});

test("numLen", () => {
	expect(numLen(-10)).toBe(2);
	expect(numLen(0)).toBe(1);
	expect(numLen(1)).toBe(1);
	expect(numLen(9)).toBe(1);
	expect(numLen(99.99)).toBe(2);
	expect(numLen(123456789)).toBe(9);
});

test("isPowerOf2", () => {
	let mask = 2;

	for (let i = 0; i < 29; i++) {
		mask <<= 1;
		expect(isPowerOf2(mask - 1)).toBe(false);
		expect(isPowerOf2(mask)).toBe(true);
		expect(isPowerOf2(mask + 1)).toBe(false);
	}
});

test("isPowerOf2i64", () => {
	let mask = 2;

	for (let i = 0; i < 45; i++) {
		mask *= 2;
		expect(isPowerOf2i64(mask - 1)).toBe(false);
		expect(isPowerOf2i64(mask)).toBe(true);
		expect(isPowerOf2i64(mask + 1)).toBe(false);
	}
});
