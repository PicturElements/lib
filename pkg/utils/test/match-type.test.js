import matchType from "../match-type";

it("correctly matches types", () => {
	[
		[true,		"Test",	"string"],
		[true,		"",		String],
		[true,		"tst",	v => typeof v == "string"],
		[true,		"tst",	["number", Boolean, v => typeof v == "string"]],
		[true,		true,	["number", Boolean, v => typeof v == "string"]],
		[true,		43,		["number", Boolean, v => typeof v == "string"]],
		[false,		null,	["number", Boolean, v => typeof v == "string"]],
		[true,		null,	"object"],
		[false,		null,	null],
		[false,		{},		null],
		[false,		{},		undefined],
		[true,		{},		Object],
		[true,		[],		Array],
		[false,		[],		[]]
	].forEach(([match, val, type]) => {
		// console.log(val, type);
		expect(matchType(val, type, false)).toBe(match);
	});
});
