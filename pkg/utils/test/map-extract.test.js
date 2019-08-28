import mapExtract from "../src/map-extract";

const MAP = {
	a: "a1",
	b: ["b1", 2],
	c: 3,
	d: "nested.d1"
};

const SRC = {
	a1: 1,
	c1: -1,
	nested: {
		d1: 4
	}
};

it("successfully extracts data", () => {
	expect(mapExtract({
			c: -1,
			e: 5
		}, MAP, SRC))
		.toStrictEqual({
			a: 1,
			b: 2,
			c: 3,
			d: 4,
			e: 5
		});
});
