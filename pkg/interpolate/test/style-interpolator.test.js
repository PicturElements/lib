import { StyleInterpolator } from "../";

it("correctly interpolates a style object", () => {
	const inter = StyleInterpolator.c({
		color: "red >> #0f0 >> blue",
		transform: "rotate(0deg) >> rotate(1turn)"
	});

	expect(inter.interpolate(0)).toStrictEqual({
		color: "rgb(255, 0, 0)",
		transform: "rotate(0deg)"
	});

	expect(inter.interpolate(0.5)).toStrictEqual({
		color: "rgb(0, 255, 0)",
		transform: "rotate(180deg)"
	});

	expect(inter.interpolate(1)).toStrictEqual({
		color: "rgb(0, 0, 255)",
		transform: "rotate(360deg)"
	});
});
