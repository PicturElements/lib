import I18N from "..";

it("TODO", () => {
	console.log(I18N);
});

describe("lang", () => {
	it("correctly computes accessors", () => {
		const formatted = I18N.fmt("#{$str[$idx + $idx] * 5}", {
			str: "abc",
			idx: 1
		});

		expect(formatted).toBe("ccccc");
	});
});
