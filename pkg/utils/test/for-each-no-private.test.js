import forEachNoPrivate from "../src/for-each-no-private";

const objWithPrivateKeys = {
	a: 1,
	_a: 1,
	b: 2,
	c: 3,
	_c: 3,
	d: 4,
	_d: 4,
	_e: 5
};

it("only iterates through non-private keys", () => {
	const keys = [];
	forEachNoPrivate(objWithPrivateKeys, (val, k) => keys.push(k));
	expect(keys.sort()).toStrictEqual(["a", "b", "c", "d"]);
});

it("accepts options", () => {
	const map = [];
	forEachNoPrivate({ _a: 1, b: 2, c: 3 }, (v, k) => map.push(k));
	forEachNoPrivate({ _a: 1, b: 2, c: 3 }, (v, k) => map.push(k), "reverse");
	expect(map).toStrictEqual(map.slice().reverse());
});

it("runs the callback function with the correct arguments", () => {
	forEachNoPrivate(objWithPrivateKeys, (val, k, obj, ...rest) => {
		expect(rest).toStrictEqual([]);
		expect(obj[k]).toBe(val);
		expect(obj).toBe(objWithPrivateKeys);
	});
});
