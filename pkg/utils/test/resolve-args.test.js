import resolveArgs from "../src/resolve-args";

const SIGNATURE = [
	{ name: "a", type: "string", required: true },
	{ name: "b", type: Object, default: "not object" },
	{ name: "c", type: a => typeof a == "string" },
	{ name: "d", type: ["object"], default: {} }
];

const COALESCING_SIGNATURE = [
	{ name: "a", type: "string", coalesce: true, required: true },
	{ name: "b", type: "boolean", coalesce: true, required: true },
	{ name: "c", type: "number" }
];

const WRAPPED = resolveArgs.wrap((...args) => args, SIGNATURE);
const WRAPPED_SINGLE_SRC = resolveArgs.wrap((...args) => args, SIGNATURE, "allowSingleSource");

it("throws when invalid arguments are passed", () => {
	expect(_ => resolveArgs()).toThrow();
	expect(_ => resolveArgs([])).toThrow();
	expect(_ => resolveArgs([], SIGNATURE)).toThrow();
	expect(_ => resolveArgs([{}], [
		{ name: "a", type: Object }
	], "allowSingleSource")).toThrow();
});

it("correctly sets default values", () => {
	expect(resolveArgs([
		"test"
	], SIGNATURE)).toStrictEqual({
		a: "test",
		b: "not object",
		c: undefined,
		d: {},
		rest: []
	});

	expect(resolveArgs([
		"test"
	], SIGNATURE, "returnArgList")).toStrictEqual([
		"test",
		"not object",
		undefined,
		{}
	]);

	expect(WRAPPED("test")).toStrictEqual([
		"test",
		"not object",
		undefined,
		{}
	]);
});

it("correctly resolves arguments with arguments that may match multiple times", () => {
	expect(resolveArgs([
		"test",
		"testing"
	], SIGNATURE)).toStrictEqual({
		a: "test",
		b: "not object",
		c: "testing",
		d: {},
		rest: []
	});

	expect(resolveArgs([
		"test",
		{ key: "b" },
		{ key: "d" }
	], SIGNATURE)).toStrictEqual({
		a: "test",
		b: { key: "b" },
		c: undefined,
		d: { key: "d" },
		rest: []
	});
});

it("correctly handles nullish empty arguments", () => {
	expect(resolveArgs([
		"test",
		null,	// empty argument for arg b
		{ key: "d" }
	], SIGNATURE)).toStrictEqual({
		a: "test",
		b: "not object",
		c: undefined,
		d: { key: "d" },
		rest: []
	});
});

it("correctly handles rest arguments", () => {
	expect(resolveArgs([
		"test",
		true
	], SIGNATURE)).toStrictEqual({
		a: "test",
		b: "not object",
		c: undefined,
		d: {},
		rest: [true]
	});

	expect(resolveArgs([
		"test",
		true
	], SIGNATURE, "returnArgList")).toStrictEqual([
		"test",
		"not object",
		undefined,
		{},
		true
	]);
});

it("supports allowSingleSource options", () => {
	expect(resolveArgs([{
		a: "test"
	}], SIGNATURE, "allowSingleSource")).toStrictEqual({
		a: "test",
		b: "not object",
		c: undefined,
		d: {},
		rest: []
	});

	expect(resolveArgs([{
		a: "test"
	}], SIGNATURE, "returnArgList|allowSingleSource")).toStrictEqual([
		"test",
		"not object",
		undefined,
		{}
	]);

	expect(WRAPPED_SINGLE_SRC({
		a: "test"
	})).toStrictEqual([
		"test",
		"not object",
		undefined,
		{}
	]);
});

it("correctly coalesces", () => {
	expect(resolveArgs([
		"this", "is", "a", "string", "of", "strings",
		true, true, true,
		42
	], COALESCING_SIGNATURE)).toStrictEqual({
		a: ["this", "is", "a", "string", "of", "strings"],
		b: [true, true, true],
		c: 42,
		rest: []
	});

	expect(_ => resolveArgs([
		"this", "is", "a", "string", "of", "strings",
		// true, true, true,
		42
	], COALESCING_SIGNATURE)).toThrow();
});
