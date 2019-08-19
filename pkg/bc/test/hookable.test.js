import Hookable from "../hookable";

it("correctly instantiates", () => {
	// Basic class stuff
	expect(_ => Hookable()).toThrow();
	const inst = new Hookable()
	expect(inst).toBeInstanceOf(Hookable);
	expect(inst.hasOwnProperty("hooks")).toBe(true);
	expect(_ => delete inst.hooks).toThrow(TypeError);
});

beforeAll(() => {
	Object.prototype.ohNo = "polluting the prototype";
});

describe("instance methods", () => {
	const nh = hooks => new Hookable(hooks),
		fn = _ => _;

	describe("hook", () => {
		it("throws if name and/or handler is invalid", () => {
			expect(_ => nh().hook()).toThrow("Failed to resolve arguments");
			expect(_ => nh().hook("test")).toThrow("Failed to resolve arguments");
			expect(_ => nh().hook(fn)).toThrow("Failed to resolve arguments");
			expect(_ => nh().hook(fn, "test")).toThrow("Failed to resolve arguments");
		});

		it("successfully hooks with (name, handler)", () => {
			const inst = nh().hook("test", fn);
			expect(inst.hooks.hasOwnProperty("test")).toBe(true);
			expect(inst.hooks.last).toStrictEqual({
				handler: fn,
				nickname: null,
				namespace: null,
				ttl: Infinity
			});
		});

		it("successfully hooks with (name, handler, ttl)", () => {
			const inst = nh().hook("test", fn, 2);
			expect(inst.hooks.hasOwnProperty("test")).toBe(true);
			expect(inst.hooks.last).toStrictEqual({
				handler: fn,
				nickname: null,
				namespace: null,
				ttl: 2
			});
		});

		it("successfully hooks with (name, handler, nickname)", () => {
			const inst = nh().hook("test", fn, "nick");
			expect(inst.hooks.hasOwnProperty("test")).toBe(true);
			expect(inst.hooks.last).toStrictEqual({
				handler: fn,
				nickname: "nick",
				namespace: null,
				ttl: Infinity
			});
		});

		it("successfully hooks with (name, handler, null, namespace)", () => {
			const inst = nh().hook("test", fn, null, "ns");
			expect(inst.hooks.hasOwnProperty("test")).toBe(true);
			expect(inst.hooks.last).toStrictEqual({
				handler: fn,
				nickname: null,
				namespace: "ns",
				ttl: Infinity
			});
		});

		it("successfully hooks with (name, handler, nickname, namespace)", () => {
			const inst = nh().hook("test", fn, "nick", "ns");
			expect(inst.hooks.hasOwnProperty("test")).toBe(true);
			expect(inst.hooks.last).toStrictEqual({
				handler: fn,
				nickname: "nick",
				namespace: "ns",
				ttl: Infinity
			});
		});

		it("successfully hooks with (name, handler, nickname, namespace, ttl)", () => {
			const inst = nh().hook("test", fn, "nick", "ns", 2);
			expect(inst.hooks.hasOwnProperty("test")).toBe(true);
			expect(inst.hooks.last).toStrictEqual({
				handler: fn,
				nickname: "nick",
				namespace: "ns",
				ttl: 2
			});
		});

		it("doesn't allow setting of hooks in reserved fields", () => {
			const warn = console.warn;
			console.warn = jest.fn();
			nh().hook("last", fn);
			expect(console.warn.mock.calls.length).toBe(1);
			console.warn = warn;
		});
	});

	describe("hookNS", () => {
		it("hooks with namespace as first parameter", () => {
			const inst = nh().hookNS("ns", "test", fn, 2);
			expect(inst.hooks.hasOwnProperty("test")).toBe(true);
			expect(inst.hooks.last).toStrictEqual({
				handler: fn,
				nickname: null,
				namespace: "ns",
				ttl: 2
			});
		});

		it("makes both the namespace and name required arguments", () => {
			expect(_ => nh().hookNS("ns", fn, 2)).toThrow();
		});
	});
	
	describe("hookAll", () => {
		const HOOKS_ARR = [
			{
				name: "test",
				handler: fn,
				ttl: 0
			},
			{
				name: "test",
				handler: fn,
				ttl: 1
			},
			{
				name: "test",
				handler: fn,
				ttl: 2
			}
		];

		const HOOKS_OBJ = {
			testing() {},
			hooks() {},
			here() {}
		};

		it("hooks with array", () => {
			const inst = nh().hookAll(HOOKS_ARR);
			expect(inst.hooks.test.length).toBe(3);
			expect(inst.hooks.test.every((h, i) => h.ttl == i)).toBe(true);
		});

		it("hooks with object", () => {
			const inst = nh(),
				defaultHooksLen = Object.keys(inst.hooks).length;
			
			inst.hookAll(HOOKS_OBJ);
			expect(Object.keys(inst.hooks).length - defaultHooksLen).toBe(3);
		});

		it("hooks with array in object and sets the object key name as the name for all hooks", () => {
			const inst = nh().hookAll({
				almostTest: HOOKS_ARR
			});

			expect(inst.hooks.test).toBe(undefined);
			expect(inst.hooks.almostTest.length).toBe(3);
		});

		it("fails gracefully when no valid data is supplied", () => {
			expect(_ => nh().hookAll(null)).not.toThrow();
		});
	});
	
	describe("unhook", () => {
		it("unhooks based on handler ref and deletes partition when empty", () => {
			const inst = nh()
				.hook("test", fn)
				.hook("test", fn)
				.hook("test", fn);

			expect(inst.hooks.test.length).toBe(3);
			inst.unhook("test", fn);
			expect(inst.hooks.test).toBe(undefined);
		});

		it("unhooks based on nickname", () => {
			const inst = nh()
				.hook("test", fn, "nick")
				.hook("test", fn, "nick")
				.hook("test", fn);

			expect(inst.hooks.test.length).toBe(3);
			inst.unhook("test", "nick");
			expect(inst.hooks.test.length).toBe(1);
		});

		it("doesn't attempt to unhook nonexistent hooks or reserved fields", () => {
			expect(_ => nh().unhook("test")).not.toThrow();
			expect(_ => nh().unhook("last")).not.toThrow();
		});
	});
	
	describe("callHooks", () => {
		it("calls all hooks with the same name with the correct arguments", () => {
			const func = jest.fn((...args) => args.reduce((sum, v) => sum + v)),
				inst = nh()
				.hook("test", func)
				.hook("test", func)
				.hook("test", func);

			inst.callHooks("test", 1, 2, 3);

			expect(func.mock.calls.length).toBe(3);
			expect(func.mock.calls.every(c => c.value == 6));
		});

		it("correctly calls hooks with a set ttl the correct amount of times before discarding the data", () => {
			const fns = [jest.fn(), jest.fn(), jest.fn()];
			
			const inst = nh()
				.hook("test", fns[0], 0)
				.hook("test", fns[1], 1)
				.hook("test", fns[2], 2);

			for (let i = 0; i < 3; i++)
				inst.callHooks("test");

			for (let i = 0; i < 3; i++)
				expect(fns[i].mock.calls.length).toBe(i);
			
			expect(inst.hooks.test).toBe(undefined);
		});
	});
	
	describe("clearHooks", () => {
		it("clears all non-reserved hooks fields", () => {
			const inst = nh(),
				defaultHooksLen = Object.keys(inst.hooks).length;

			inst
				.hook("test", fn)
				.hook("test2", fn)
				.hook("test3", fn);

			expect(Object.keys(inst.hooks).length - defaultHooksLen).toBe(3);
			inst.clearHooks();
			expect(Object.keys(inst.hooks).length - defaultHooksLen).toBe(0);
		});
	});
	
	describe("clearHooksNS", () => {
		it("only removes namespaces hooks", () => {
			const inst = nh(),
				defaultHooksLen = Object.keys(inst.hooks).length;

			inst
				.hook("test", fn, null, "ns")
				.hook("test", fn, "nick", "ns2")
				.hook("test2", fn, null, "ns")
				.hook("test3", fn, null, "ns");

			expect(Object.keys(inst.hooks).length - defaultHooksLen).toBe(3);
			inst.clearHooksNS("ns");
			expect(Object.keys(inst.hooks).length - defaultHooksLen).toBe(1);
			expect(inst.hooks.test[0].nickname).toBe("nick");
		});
	});
});

afterAll(() => {
	delete Object.prototype.ohNo;
});
