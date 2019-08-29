import Color from "../";

beforeAll(() => {
	Color.suppressWarnings = true;
});

function expectRGBA(src, space, r = 0, g = 0, b = 0, a = 1) {
	const col = new Color(src);

	expect(col.space).toBe(space);

	if (space)
		expect(col.rgba).toStrictEqual([r, g, b, a]);
	else
		expect(col.rgba).toStrictEqual([0, 0, 0, 0]);
}

describe("correct parsing", () => {
	test("hex", () => {
		expectRGBA("#cccccc", "hex", 204, 204, 204);
		expectRGBA("#ccc", "hex", 204, 204, 204);
		expectRGBA("#cccccc66", "hex", 204, 204, 204, 0.4);
		expectRGBA("#ccc6", "hex", 204, 204, 204, 0.4);
	});

	test("rgb", () => {
		expectRGBA("rgb(  0,  1,  2  )", "rgb", 0, 1, 2);
		expectRGBA("rgb(-1, 255, 2000)", "rgb", 0, 255, 255);
		expectRGBA("rgb(10.3, 10.5, 1.2e1)", "rgb", 10, 11, 12);
		expectRGBA("rgb(50%, 50%, 50%)", "rgb", 128, 128, 128);
		expectRGBA("rgb(20  40  80)", "rgb", 20, 40, 80);
		expectRGBA("rgb(50%50%50%)", "rgb", 128, 128, 128);
	});

	test("rgba", () => {
		expectRGBA("rgba(  0,  1,  2,  0.5  )", "rgba", 0, 1, 2, 0.5);
		expectRGBA("rgba(-1, 255, 2000, 0.123456)", "rgba", 0, 255, 255, 0.12);
		expectRGBA("rgba(10.3, 10.5, 1.2e1, 1e3)", "rgba", 10, 11, 12, 1);
		expectRGBA("rgba(50%, 50%, 50%, 50%)", "rgba", 128, 128, 128, 0.5);
		expectRGBA("rgba(  20  40  80  /  2e-1  )", "rgba", 20, 40, 80, 0.2);
		expectRGBA("rgba(50%50%50%/0.5)", "rgba", 128, 128, 128, 0.5);
	});

	test("hsl", () => {
		expectRGBA("hsl(0, 100%, 50%)", "hsl", 255, 0, 0);
		expectRGBA("hsl(180deg, 100%, 50%)", "hsl", 0, 255, 255);
		expectRGBA("hsl(0.5turn, 100%, 50%)", "hsl", 0, 255, 255);
		expectRGBA("hsl(3.1415rad, 100%, 50%)", "hsl", 0, 255, 255);
		expectRGBA("hsl(200grad, 100%, 50%)", "hsl", 0, 255, 255);
		expectRGBA("hsl(360 100% 50%)", "hsl", 255, 0, 0);
	});

	test("hsla", () => {
		expectRGBA("hsla(0, 100%, 50%, 0.5)", "hsla", 255, 0, 0, 0.5);
		expectRGBA("hsla(180deg, 100%, 50%, 50%)", "hsla", 0, 255, 255, 0.5);
		expectRGBA("hsla(0.5turn, 100%, 50%, 5e-1)", "hsla", 0, 255, 255, 0.5);
		expectRGBA("hsla(3.1415rad, 100%, 50%, 50%)", "hsla", 0, 255, 255, 0.5);
		expectRGBA("hsla(200grad, 100%, 50%, 0.5)", "hsla", 0, 255, 255, 0.5);
		expectRGBA("hsla(360 100% 50% / 50%)", "hsla", 255, 0, 0, 0.5);
	});

	test("cmyk", () => {
		expectRGBA("cmyk(66%, 47%, 77%, 22%)", "cmyk", 68, 105, 46);
		expectRGBA("cmyk(66% 47% 77% 22%)", "cmyk", 68, 105, 46);
	});
});

describe("correct fail on syntax error", () => {
	test("hex", () => {
		expectRGBA("#ccccccccc", null);
		expectRGBA("#ccccccc", null);
		expectRGBA("#ccccc", null);
		expectRGBA("#cc", null);
		expectRGBA("#", null);
	});

	test("rgb", () => {
		expectRGBA("rgb(0, 1)", null);
		expectRGBA("rgb(1e, 255, 200)", null);
		expectRGBA("rgb(50%, 50%, 0.5)", null);
		expectRGBA("rgb(20 40, 80)", null);
	});

	test("rgba", () => {
		expectRGBA("rgba(0, 1, 2, 0.5, 1)", null);
		expectRGBA("rgba(10.3, 10.5, 1.2e1, 1e)", null);
		expectRGBA("rgba(50%, 128, 50%, 50%)", null);
		expectRGBA("rgba(20 40 80 2e-1)", null);
		expectRGBA("rgba(20 40 80, 2e-1)", null);
	});

	test("hsl", () => {
		expectRGBA("hsl(0, 100%, 50)", null);
		expectRGBA("hsl(0.5turns, 100%, 50%)", null);
		expectRGBA("hsl(360, 100% 50%)", null);
	});

	test("hsla", () => {
		expectRGBA("hsla(0, 100, 50%, 0.5)", null);
		expectRGBA("hsl(0.5turns, 100%, 50%, 50%)", null);
		expectRGBA("hsla(360 100% 50% 50%)", null);
		expectRGBA("hsla(360 100% 50%, 50%)", null);
	});

	test("cmyk", () => {
		expectRGBA("cmyk(66%, 47, 77%, 22%)", null);
		expectRGBA("cmyk(66% 47% 77% / 22%)", null);
	});
});

function expectStringify(src, stringified = src) {
	expect(new Color(src).str()).toBe(stringified);
}

describe("correct stringification from color space field", () => {
	test("hex", () => {
		expectStringify("#cccccc", "#ccc");
		expectStringify("#ccc");
		expectStringify("#cccccc66", "#ccc6");
		expectStringify("#ccc6");
	});

	test("rgb", () => {
		expectStringify("rgb(0, 1, 2)");
		expectStringify("rgb(-1, 255, 2000)", "rgb(0, 255, 255)");
		expectStringify("rgb(10.3, 10.5, 1.2e1)", "rgb(10, 11, 12)");
		expectStringify("rgb(50%50%50%)", "rgb(128, 128, 128)");
		expectStringify("rgb(50%50%50%/0.5)", "rgba(128, 128, 128, 0.5)");
	});

	test("rgba", () => {
		expectStringify("rgba(  0,  1,  2,  0.5  )", "rgba(0, 1, 2, 0.5)");
		expectStringify("rgba(-1, 255, 2000, 0.123456)", "rgba(0, 255, 255, 0.12)");
		expectStringify("rgba(10.3, 10.5, 1.2e1, 1e3)", "rgba(10, 11, 12, 1)");
		expectStringify("rgba(50% 50% 50% / 0.5)", "rgba(128, 128, 128, 0.5)");
		expectStringify("rgba(50% 50% 50%)", "rgb(128, 128, 128)");
	});

	test("hsl", () => {
		expectStringify("hsl(0, 100%, 50%)");
		expectStringify("hsl(180deg, 100%, 50%)", "hsl(180, 100%, 50%)");
		expectStringify("hsl(0.5turn, 100%, 50%)", "hsl(180, 100%, 50%)");
		expectStringify("hsl(3.1415rad, 100%, 50%)", "hsl(180, 100%, 50%)");
		expectStringify("hsl(200grad, 100%, 50%)", "hsl(180, 100%, 50%)");
		expectStringify("hsl(360 100% 50%)", "hsl(0, 100%, 50%)");
		expectStringify("hsl(360 100% 50% / 0.5)", "hsla(0, 100%, 50%, 0.5)");
	});

	test("hsla", () => {
		expectStringify("hsla(0, 100%, 50%, 0.5)");
		expectStringify("hsla(180deg, 100%, 50%, 50%)", "hsla(180, 100%, 50%, 0.5)");
		expectStringify("hsla(0.5turn, 100%, 50%, 5e-1)", "hsla(180, 100%, 50%, 0.5)");
		expectStringify("hsla(3.1415rad, 100%, 50%, 50%)", "hsla(180, 100%, 50%, 0.5)");
		expectStringify("hsla(200grad, 100%, 50%, 0.5)", "hsla(180, 100%, 50%, 0.5)");
		expectStringify("hsla(360 100% 50% / 50%)", "hsla(0, 100%, 50%, 0.5)");
	});

	test("cmyk", () => {
		expectStringify("cmyk(66%, 47%, 77%, 22%)", "cmyk(35%, 0%, 56%, 59%)");
		expectStringify("cmyk(66% 47% 77% 22%)", "cmyk(35%, 0%, 56%, 59%)");
	});
});

afterAll(() => {
	Color.suppressWarnings = false;
});
