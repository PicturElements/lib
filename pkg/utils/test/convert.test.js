import {
	convert,
	mkConverter
} from "../src/convert";

const UNIT_CONV = {
		deg: {
			rad: Math.PI / 180,
			grad: 400 / 360,
			turn: v => v / 360
		},
		rad: "deg",
		grad: "deg",
		turn: "deg"
	},
	UNITS = ["deg", "rad", "grad", "turn"],
	TEST_VALUES = [-12, 0, 1, 45];

it("correctly converts using correspondence object", () => {
	expect(convert(UNIT_CONV, 180, "deg", "rad")).toBe(Math.PI);
	expect(convert(UNIT_CONV, 180, "deg", "grad")).toBe(200);
});

it("correctly converts using units", () => {
	expect(convert(UNIT_CONV, Math.PI, "rad", "deg")).toBe(180);
	expect(convert(UNIT_CONV, 200, "grad", "deg")).toBeCloseTo(180, 5);
});

it("correctly binds converters", () => {
	const converter = mkConverter(UNIT_CONV);
	expect(converter(Math.PI, "rad", "deg")).toBe(180);
	expect(converter(200, "grad", "deg")).toBeCloseTo(180, 5);
});

it("passes the correct arguments to getter functions", () => {
	const converted = convert({
		test: {
			getter(val, from, to, ...rest) {
				expect(rest.length).toBe(0);
				expect(val).toBe(3);
				expect(from).toBe("test");
				expect(to).toBe("getter");
				return val * 2;
			}
		}
	}, 3, "test", "getter");

	expect(converted).toBe(6);
});

it("correctly converts between all specified units", () => {
	const conv = mkConverter(UNIT_CONV);

	UNITS.forEach(u => {
		UNITS.forEach(u2 => {
			TEST_VALUES.forEach(v => {
				expect(conv(conv(v, u, u2), u2, u)).toBeCloseTo(v, 5);
			});
		});
	});
});

it("gracefully fails when no conversion is found", () => {
	expect(convert(UNIT_CONV, 0, "test", "foo")).toBe(null);
	expect(convert(UNIT_CONV, 0, "deg", "foo")).toBe(null);
	expect(convert({ wrongType: true }, 0, "wrongType", "foo")).toBe(null);
	expect(convert({ nullObj: null }, 0, "nullObj", "foo")).toBe(null);
});
