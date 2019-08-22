import clone from "../clone";

const DATA = {
	num: 42,
	obj: {
		str: "string",
		[Symbol("sym")]: Symbol
	},
	arr: [
		false,
		NaN,
		undefined,
		null
	],
	nest: {
		obj: {
			arr: [
				{
					undef: undefined
				}
			]
		}
	}
};

it("correctly clones non-symbol keys", () => {
	expect(clone(DATA)).not.toStrictEqual(DATA);
	expect(clone(DATA).obj).not.toBe(DATA.obj);
});

it("supports depth/shallow options", () => {
	expect(clone(DATA, "shallow").obj).toBe(DATA.obj);
	expect(clone(DATA, { depth: 2 }).nest).not.toBe(DATA.nest);
	expect(clone(DATA, { depth: 2 }).nest.obj).not.toBe(DATA.nest.obj);
});

it("supports cloneSymbols option and clones symbol keys", () => {
	expect(clone(DATA, "cloneSymbols")).toStrictEqual(DATA);
	expect(clone(DATA, {
		cloneSymbols: true,
		depth: 1
	})).toStrictEqual(DATA);
	expect(clone(DATA, "cloneSymbols").obj).not.toBe(DATA.obj);
});

it("doesn't clone instances by default", () => {
	const set = new Set([1, 2, 3, 4]);

	expect(clone({
		a: 1,
		set
	})).toStrictEqual({
		a: 1,
		set
	});
});

it("clones instances into appropriate Object or Array", () => {
	const set = new Set([1, 2, 3, 4]);

	expect(clone({
		a: 1,
		set
	}, "cloneInstances")).toStrictEqual({
		a: 1,
		set: [1, 2, 3, 4]
	});
});

it("supports cloning primitives", () => {
	expect(clone(1)).toBe(1);
	expect(clone(true)).toBe(true);
	expect(clone("test")).toBe("test");
	expect(clone(Symbol.for("sym"))).toBe(Symbol.for("sym"));
	expect(clone(null)).toBe(null);
	expect(clone(undefined)).toBe(undefined);
});
