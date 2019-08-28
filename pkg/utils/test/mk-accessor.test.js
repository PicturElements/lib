import mkAccessor from "../src/mk-accessor";

it("creates a valid, split-path compatible path", () => {
	expect(mkAccessor([])).toBe("");
	expect(mkAccessor(["a", "b", "c", 0, 1])).toBe("a.b.c[0][1]");
	expect(mkAccessor(["space space", "force"])).toBe("[space space].force");
	expect(mkAccessor(["a", "[bracket]"])).toBe("a[[bracket\\]]");
	expect(mkAccessor([" '' ", "]"])).toBe("[ \\'\\' ][\\]]");
});
