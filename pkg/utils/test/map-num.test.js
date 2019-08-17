import mapNum from "../map-num";

it("correctly maps and wraps data", () => {
	expect(mapNum({ z: 3 }, "axes2d", [1, 2]))
		.toStrictEqual({
			x: 1,
			y: 2,
			z: 3
		});

	expect(mapNum({}, "axes2d", [1]))
		.toStrictEqual({
			x: 1,
			y: 1
		});

	expect(mapNum({}, "axes2d", 1))
		.toStrictEqual({
			x: 1,
			y: 1
		});
});

it("supports mapping callbacks and wraps their output", () => {
	expect(mapNum({ z: 3 }, "axes2d", [1, 2], num => num * 2))
		.toStrictEqual({
			x: 2,
			y: 4,
			z: 3
		});
});

it("runs the callback function with the correct arguments and skips invalid data", () => {
	const target = {};

	mapNum(target, "axes3d", [1, 2, NaN], (num, val, key, targ, ...rest) => {
		expect(rest).toStrictEqual([]);
		expect(typeof num).toBe("number");
		expect(num).not.toBe(NaN);
		expect(targ[key]).toBe(val);
		expect(targ).toBe(target);

		return num * 2;
	});

	expect(target).toStrictEqual({
		x: 2,
		y: 4
	});
});
