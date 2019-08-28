import get from "../src/get";
import mkAccessor from "../src/mk-accessor";
import { isObj } from "../src/is";

const getData = _ => ({
		num: 42,
		obj: {
			str: "string"
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
				],
				"key with spaces": 42,
				"key[with]brackets": 43
			}
		}
	}),
	DATA = getData(),
	ITEM_COUNT = 16;

it("accesses all properties", () => {
	let count = 0;

	const traverse = (item, path) => {
		const accessor = mkAccessor(path);
		expect(get(DATA, accessor)).toBe(item);
		count++;

		if (isObj(item)) {
			for (const k in item)
				traverse(item[k], path.concat(k));
		}
	};

	traverse(DATA, []);
	expect(count).toBe(ITEM_COUNT);
});

it("treats invalid paths as null accessors", () => {
	expect(get(42, null)).toBe(42);
	expect(get(42)).toBe(42);
	expect(get(42, false)).toBe(42);
	expect(get(42, { a: 42 })).toBe(42);
});

it("gracefully fails and returns a default value when no data is found", () => {
	expect(get(null, "a.b", "def")).toBe("def");
	expect(get([], "a.b", "def")).toBe("def");
	expect(get({ a: { c: 12 } }, "a.b", "def")).toBe("def");
	expect(get(0, "a.b", "def")).toBe("def");
});

describe("options work", () => {
	test("pathOffset", () => {
		expect(get(DATA.nest.obj, "nest.obj", null, {
			pathOffset: 2
		})).toBe(DATA.nest.obj);
	
		expect(get(DATA.nest.obj, "nest.obj.arr", null, {
			pathOffset: 2
		})).toBe(DATA.nest.obj.arr);
	});

	test("autoBuild", () => {
		const obj = {};
		get(obj, "test.a[0]", null, "autoBuild");
		
		expect(obj).toStrictEqual({
			test: {
				a: [
					{}
				]
			}
		});

		const arr = [];
		get(arr, "[0].test", null, "autoBuild");

		expect(arr).toStrictEqual([
			{
				test: {}
			}
		]);

		const arr2 = [],
			targ = [];

		targ[2] = {
			test: {}
		};

		get(arr2, "2.test", null, "autoBuild");
		expect(arr2).toStrictEqual(targ);
	});

	test("context", () => {
		expect(get(DATA, "arr[0]", null, "context"))
			.toStrictEqual({
				built: false,
				context: DATA.arr,
				data: false,
				key: "0",
				match: true
			});

		expect(get(DATA, "arr[0].nothing", 42, "context"))
			.toStrictEqual({
				built: false,
				context: DATA.arr,
				data: 42,
				key: "0",
				match: false
			});

		const d = getData();

		expect(get(d, "nest.obj.arr.nothing", null, {
				context: true,
				autoBuild: true
			}))
			.toMatchObject({
				built: true,
				context: d.nest.obj.arr,
				data: {},
				match: false,
				key: "nothing"
			});
	});

	test("trace", () => {
		expect(get(DATA, "nest.obj.arr", null, "trace"))
			.toStrictEqual({
				built: false,
				data: DATA.nest.obj.arr,
				match: true,
				nodeTrace: [DATA, DATA.nest, DATA.nest.obj],
				trace: ["nest", "obj", "arr"]
			});

		expect(get(DATA, "nest.obj.arr.nothing", null, "trace"))
			.toStrictEqual({
				built: false,
				data: null,
				match: false,
				nodeTrace: [DATA, DATA.nest, DATA.nest.obj],
				trace: ["nest", "obj", "arr"]
			});

		const d = getData();

		expect(get(d, "nest.obj.arr.nothing", null, {
				trace: true,
				autoBuild: true
			}))
			.toStrictEqual({
				built: true,
				data: {},
				match: false,
				nodeTrace: [d, d.nest, d.nest.obj, d.nest.obj.arr],
				trace: ["nest", "obj", "arr", "nothing"]
			});
	});

	test("trace and context", () => {
		expect(get(DATA, "nest.obj.arr", null, "traceContext"))
			.toStrictEqual({
				built: false,
				context: DATA.nest.obj,
				data: DATA.nest.obj.arr,
				match: true,
				key: "arr",
				nodeTrace: [DATA, DATA.nest, DATA.nest.obj],
				trace: ["nest", "obj", "arr"]
			});

		expect(get(DATA, "nest.obj.arr.nothing", null, "traceContext"))
			.toStrictEqual({
				built: false,
				context: DATA.nest.obj,
				data: null,
				match: false,
				key: "arr",
				nodeTrace: [DATA, DATA.nest, DATA.nest.obj],
				trace: ["nest", "obj", "arr"]
			});

		const d = getData();

		expect(get(d, "nest.obj.arr.nothing", null, {
			trace: true,
			context: true,
			autoBuild: true
		})).toStrictEqual({
			built: true,
			context: d.nest.obj.arr,
			data: {},
			match: false,
			key: "nothing",
			nodeTrace: [d, d.nest, d.nest.obj, d.nest.obj.arr],
			trace: ["nest", "obj", "arr", "nothing"]
		});
	});
});
