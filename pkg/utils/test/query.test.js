import query from "../src/query";

it("correctly queries objects", () => {
	const matched = query([
		{
			a: 1,
			b: 3,
			id: 0
		}, {
			a: 1,
			b: 2,
			id: 1
		}, {
			a: 0,
			b: 2,
			id: 2
		}, {
			a: 0,
			b: 3,
			id: 3
		}, {
			a: 1,
			b: "abc",
			id: 4
		},
		{
			a: 1,
			b: 2,
			id: 5
		}
	], {
		a: 1,
		b: 2
	});

	expect(matched).toStrictEqual({
		matches: [
			{
				a: 1,
				b: 2,
				id: 1
			}, {
				a: 1,
				b: 2,
				id: 5
			}
		],
		indices: [1, 5],
		iterations: 2
	});
});
