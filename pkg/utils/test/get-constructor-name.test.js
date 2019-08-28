import getConstructorName from "../src/get-constructor-name";

it("returns null for invalid constructors", () => {
	expect(getConstructorName(null)).toBe(null);
	expect(getConstructorName(undefined)).toBe(null);
});

it("returns the appropriate constructor name", () => {
	expect(getConstructorName(Set)).toBe("Function");
	expect(getConstructorName(new Map())).toBe("Map");
	expect(getConstructorName(getConstructorName)).toBe("Function");
	expect(getConstructorName("")).toBe("String");
	expect(getConstructorName(_ => _)).toBe("Function");
	expect(getConstructorName(0)).toBe("Number");
	expect(getConstructorName(true)).toBe("Boolean");
	expect(getConstructorName(Symbol("sym"))).toBe("Symbol");
});
