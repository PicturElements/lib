import {
	isDirectInstanceof,
	isNativeSimpleObject,
	isObj,
	isObject,
	isInstance,
	isConstructor,
	isIterable,
	isArrayLike
} from "../is";

test("isDirectInstanceof", () => {
	expect([] instanceof Object).toBe(true);
	expect(isDirectInstanceof([], Object)).toBe(false);
	expect(isDirectInstanceof([], Array)).toBe(true);
	expect(isDirectInstanceof({}, Object)).toBe(true);
	expect(isDirectInstanceof(Set, Function)).toBe(true);
	expect(isDirectInstanceof(new Set(), Set)).toBe(true);
	expect(isDirectInstanceof(null, Object)).toBe(false);
	expect(isDirectInstanceof("", String)).toBe(true);
	expect(isDirectInstanceof(_ => _, Function)).toBe(true);
});

test("isNativeSimpleObject", () => {
	expect(isNativeSimpleObject({})).toBe(true);
	expect(isNativeSimpleObject([])).toBe(true);
	expect(isNativeSimpleObject(Set)).toBe(false);
	expect(isNativeSimpleObject(new Set())).toBe(false);
	expect(isNativeSimpleObject(null)).toBe(false);
	expect(isNativeSimpleObject("")).toBe(false);
	expect(isNativeSimpleObject(console.log)).toBe(false);
});

test("isObj", () => {
	expect(isObj({})).toBe(true);
	expect(isObj([])).toBe(true);
	expect(isObj(Set)).toBe(false);
	expect(isObj(new Set())).toBe(true);
	expect(isObj(null)).toBe(false);
	expect(isObj("")).toBe(false);
	expect(isObj(console.log)).toBe(false);
});

test("isObject", () => {
	expect(isObject({})).toBe(true);
	expect(isObject([])).toBe(false);
	expect(isObject(Set)).toBe(false);
	expect(isObject(new Set())).toBe(false);
	expect(isObject(null)).toBe(false);
	expect(isObject("")).toBe(false);
	expect(isObject(console.log)).toBe(false);
});

test("isInstance", () => {
	expect(isInstance({})).toBe(true);
	expect(isInstance([])).toBe(true);
	expect(isInstance(Set)).toBe(false);
	expect(isInstance(new Set())).toBe(true);
	expect(isInstance(null)).toBe(false);
	expect(isInstance("")).toBe(true);
	expect(isInstance(console.log)).toBe(true);
});

test("isConstructor", () => {
	expect(isConstructor({})).toBe(false);
	expect(isConstructor([])).toBe(false);
	expect(isConstructor(Set)).toBe(true);
	expect(isConstructor(new Set())).toBe(false);
	expect(isConstructor(null)).toBe(false);
	expect(isConstructor("")).toBe(false);
	expect(isConstructor(console.log)).toBe(false);
});

test("isIterable", () => {
	expect(isIterable({})).toBe(false);
	expect(isIterable([])).toBe(true);
	expect(isIterable(Set)).toBe(false);
	expect(isIterable(new Set())).toBe(true);
	expect(isIterable(null)).toBe(false);
	expect(isIterable("")).toBe(true);
	expect(isIterable(console.log)).toBe(false);
});

test("isArrayLike", () => {
	expect(isArrayLike({})).toBe(false);
	expect(isArrayLike([])).toBe(true);
	expect(isArrayLike(Set)).toBe(false);
	expect(isArrayLike(new Set())).toBe(false);
	expect(isArrayLike(null)).toBe(false);
	expect(isArrayLike("")).toBe(true);
	expect(isArrayLike(console.log)).toBe(false);
});
