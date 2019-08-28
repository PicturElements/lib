import getFunctionName from "../src/get-function-name";

it("returns null for invalid values", () => {
	expect(getFunctionName(null)).toBe(null);
	expect(getFunctionName(undefined)).toBe(null);
	expect(getFunctionName(0)).toBe(null);
	expect(getFunctionName(true)).toBe(null);
	expect(getFunctionName("")).toBe(null);
	expect(getFunctionName(Symbol("sym"))).toBe(null);
});

it("returns the appropriate constructor name", () => {
	expect(getFunctionName(Set)).toBe("Set");
	expect(getFunctionName(getFunctionName)).toBe("getFunctionName");
	expect(getFunctionName(_ => _)).toBe("");
	expect(getFunctionName(function() {})).toBe("");
});
