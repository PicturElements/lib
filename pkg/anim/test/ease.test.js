import { Ease } from "../";

it("correctly compiles a bézier curve", () => {
	// Linear function Bézier
	const easing = Ease.compile("cubic-bezier(0, 0, 1, 1)");
	expect(typeof easing).toBe("function");

	for (let i = 0; i < 1e3; i++) {
		const val = i / 1e3;
		expect(easing(val)).toBeCloseTo(val, 5);
	}
});
