import immutate from "../immutate";

const getData = _ => ({
	a: 1,
	b: "test",
	c: [
		{
			d: false
		},
		2,
		3
	]
});

describe("makes deep objects immutable", () => {
	const trySet = (target, key) => {
		return () => {
			target[key] = null;
		};
	};

	const proxy = immutate(getData());

	it("successfully disables setting set properties", () => {
		expect(trySet(proxy, "a")).toThrow(TypeError);
		expect(trySet(proxy, "b")).toThrow(TypeError);
		expect(trySet(proxy.c, 0)).toThrow(TypeError);
		expect(trySet(proxy.c[0], "d")).toThrow(TypeError);
	});

	it("successfully disables setting unset properties", () => {
		expect(trySet(proxy, "d")).toThrow(TypeError);
		expect(trySet(proxy.c[0], "e")).toThrow(TypeError);
	});
});

it("doesn't affect the source object", () => {
	const canSet = (target, key) => {
		target[key] = Symbol.for("unique");
		return target[key] == Symbol.for("unique");
	};

	const data = getData(),
		proxy = immutate(data);

	expect(canSet(data, "a")).toBe(true);
	expect(canSet(data, "b")).toBe(true);
	expect(canSet(data.c, 0)).toBe(true);
	expect(canSet(data.c, 6)).toBe(true);
});
