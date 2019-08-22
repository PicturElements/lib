import forEach from "../for-each";

const DATA = {
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
		// Should never iterate over symbols
		[Symbol("sym")]: Symbol
	},
	SPARSE = Array(10);

SPARSE[3] = 1;
SPARSE[5] = 2;
SPARSE[8] = 3;

const ARR = [1, 2, 3, 4],
	OBJ = { a: 1, b: 2, c: 3, d: 4 },
	ITERABLE = new Set([1, 2, 3, 4]);

describe("correctly iterates", () => {
	test("over arrays", () => {
		const callback = jest.fn();
		// Array is sparse but the stock settings for
		// forEach should not mind that
		forEach(Array(10), callback);
		expect(callback.mock.calls.length).toBe(10);
	});

	test("over sparse arrays with sparse option", () => {
		const callback = jest.fn();
		forEach(SPARSE, callback, "sparse");
		expect(callback.mock.calls.length).toBe(3);
	});

	test("over enumerable object keys", () => {
		const callback = jest.fn();
		forEach(DATA, callback);
		expect(callback.mock.calls.length).toBe(Object.keys(DATA).length);
	});

	test("over iterables", () => {
		const callback = jest.fn();
		forEach(new Set([1, 2, 3, 4, 5]), callback);
		expect(callback.mock.calls.length).toBe(5);
	});
});

describe("correctly iterates in reverse", () => {
	const isReverseNumberArr = a => {
		let last = null;
	
		for (const item of a) {
			if (typeof item != "number" || last !== null && item > last)
				return false;

			last = item;
		}

		return true;
	};

	test("over arrays", () => {
		const indices = [],
			callback = jest.fn((val, idx) => indices.push(idx));

		forEach(Array(10), callback, "reverse");
		expect(callback.mock.calls.length).toBe(10);
		expect(isReverseNumberArr(indices)).toBe(true);
	});

	test("over sparse arrays with sparse option", () => {
		const indices = [],
			callback = jest.fn((val, idx) => indices.push(idx));

		forEach(SPARSE, callback, { sparse: true, reverse: true });
		expect(callback.mock.calls.length).toBe(3);
		expect(isReverseNumberArr(indices)).toBe(true);
	});

	test("over enumerable object keys", () => {
		const keys = [],
			callback = jest.fn((val, k) => keys.push(k));

		forEach(DATA, callback);
		forEach(DATA, callback, "reverse");
		expect(callback.mock.calls.length).toBe(Object.keys(DATA).length * 2);
		expect(keys).toStrictEqual(keys.slice().reverse());
	});

	test("over iterables", () => {
		const indices = [],
			callback = jest.fn((val, idx) => indices.push(idx));

		forEach(new Set([1, 2, 3, 4, 5]), callback, "reverse");
		expect(callback.mock.calls.length).toBe(5);
		expect(isReverseNumberArr(indices)).toBe(true);
	});
});

describe("correctly handles iterables", () => {
	class MockedArray extends Array {
		constructor(...args) {
			super(...args);
		}

		[Symbol.iterator]() {
			return (function*() {
				yield 1;
				yield 2;
				yield 3;
			})();
		}
	}

	test("defers iterable array-likes in favor of faster for loop", () => {
		const callback = jest.fn();
		forEach(new MockedArray(4), callback);
		expect(callback.mock.calls.length).toBe(4);
	});

	test("forces iterator with iterable option", () => {
		const callback = jest.fn();
		forEach(new MockedArray(4), callback, "iterable");
		expect(callback.mock.calls.length).toBe(3);
	});

	test("handles iterator return values as both keys and values with isSetLike option", () => {
		const mArr = new MockedArray(),
			vals = [];
		forEach(mArr, v => vals.push(v), { iterable: true, isSetLike: true });
		expect(vals).toStrictEqual([...mArr]);
	});

	test("calls a .done postfix operation once", () => {
		const func = jest.fn();

		forEach([1, 2, 3, 4], _ => _)
			.done((...args) => {
				func();
			});

		expect(func.mock.calls.length).toBe(1);
	});
});

describe("runs the callback function with the correct arguments", () => {
	const runner = (target, options) => {
		forEach(target, (val, k, obj, ...rest) => {
			expect(rest).toStrictEqual([]);
			expect(obj).toBe(target);
			
			if (target instanceof Set)
				expect(obj.has(k)).toBe(true);
			else
				expect(obj[k]).toBe(val);
		}, options);
	};
	
	test("on arrays", () => {
		runner(ARR);
	});

	test("on enumerable object keys", () => {
		runner(OBJ);
	});

	test("on iterables", () => {
		runner(ITERABLE);
	});
	
	test("on arrays in reverse", () => {
		runner(ARR, "reverse");
	});

	test("on enumerable object keys in reverse", () => {
		runner(OBJ, "reverse");
	});

	test("on iterables in reverse", () => {
		runner(ITERABLE, "reverse");
	});
});

describe("handles breaks correctly", () => {
	const breaksFunc = (target, options) => {
			let count = 0;

			const breakRet = forEach(target, _ => {
				if (count == 2)
					return forEach.BREAK;

				count++;
			}, options);

			// Since forEach.BREAK sets depth to 1,
			// the token is invalidated after one break
			return breakRet == forEach && count == 2;
		},
		finishingFunc = (target, options) => {
			let count = 0;
			const breakRet = forEach(target, _ => count++, options);
			return breakRet != forEach.BREAK && count == 4;
		};

	test("breaks with arrays", () => {
		expect(breaksFunc(ARR)).toBe(true);
	});

	test("breaks with enumerable object keys", () => {
		expect(breaksFunc(OBJ)).toBe(true);
	});

	test("breaks with iterables", () => {
		expect(breaksFunc(ITERABLE)).toBe(true);
	});

	test("breaks with arrays in reverse", () => {
		expect(breaksFunc(ARR, "reverse")).toBe(true);
	});

	test("breaks with enumerable object keys in reverse", () => {
		expect(breaksFunc(OBJ, "reverse")).toBe(true);
	});

	test("breaks with iterables in reverse", () => {
		expect(breaksFunc(ITERABLE, "reverse")).toBe(true);
	});

	test("doesn't return forEach.BREAK when not necessary", () => {
		expect(finishingFunc(ARR)).toBe(true);
		expect(finishingFunc(OBJ)).toBe(true);
		expect(finishingFunc(ITERABLE)).toBe(true);
		expect(finishingFunc(ARR, "reverse")).toBe(true);
		expect(finishingFunc(OBJ, "reverse")).toBe(true);
		expect(finishingFunc(ITERABLE, "reverse")).toBe(true);
	});

	test("breaks nested forEach", () => {
		let outerCount = 0,
			innerCount = 0;

		forEach(ARR, (_, idx) => {
			outerCount++;

			return forEach(ARR, _ => {
				if (idx == 2)
					return forEach.BREAK_ALL;

				innerCount++;
			});
		});

		expect(outerCount).toBe(3);
		expect(innerCount).toBe(8);	// 2 * ARR[4]
	});

	test("breaks nested forEach with label", () => {
		const data = ["good", "good", "bad", "decent"],
			dataAcc = [];

		forEach([1, 2], _ => {
			const acc = [];

			forEach.l("outer")(data, str => {
				const split = [];

				return forEach(str, char => {
					if (str == "bad")
						return forEach.BREAK("outer");

					split.push(char);
				}).done(_ => {
					acc.push(split);
				});
			});
			
			dataAcc.push(acc);
		});

		expect(dataAcc).toStrictEqual([
			[["g", "o", "o", "d"], ["g", "o", "o", "d"]],
			[["g", "o", "o", "d"], ["g", "o", "o", "d"]]
		]);
	});

	test("breaks nested forEach with depth", () => {
		const data = ["good", "good", "bad", "decent"],
			dataAcc = [];

		forEach([1, 2], _ => {
			const acc = [];

			forEach(data, str => {
				const split = [];

				return forEach(str, char => {
					if (str == "bad")
						return forEach.BREAK(2);

					split.push(char);
				}).done(_ => {
					acc.push(split);
				});
			});
			
			dataAcc.push(acc);
		});

		expect(dataAcc).toStrictEqual([
			[["g", "o", "o", "d"], ["g", "o", "o", "d"]],
			[["g", "o", "o", "d"], ["g", "o", "o", "d"]]
		]);
	});

	test("calls an .exit postfix operation once upon break", () => {
		const func = jest.fn();
		let a = null;

		forEach(ARR, _ => forEach.BREAK_ALL)
			.exit(_ => {
				func();
			});

		expect(func.mock.calls.length).toBe(1);
	});
});

describe("handles continues correctly", () => {
	const continuesFunc = (target, options) => {
			let count = 0,
				inc = 0;

			const continueRet = forEach(target, _ => {
				if (count++ == 1)
					return forEach.CONTINUE;

				inc++;
			}, options);

			return continueRet == forEach && inc == 3;
		};
	
	test("continues with arrays", () => {
		expect(continuesFunc(ARR)).toBe(true);
	});

	test("continues with enumerable object keys", () => {
		expect(continuesFunc(OBJ)).toBe(true);
	});

	test("continues with iterables", () => {
		expect(continuesFunc(ITERABLE)).toBe(true);
	});

	test("continues with arrays in reverse", () => {
		expect(continuesFunc(ARR, "reverse")).toBe(true);
	});

	test("continues with enumerable object keys in reverse", () => {
		expect(continuesFunc(OBJ, "reverse")).toBe(true);
	});

	test("continues with iterables in reverse", () => {
		expect(continuesFunc(ITERABLE, "reverse")).toBe(true);
	});

	test("continues nested forEach", () => {
		let outerCount = 0,
			innerCount = 0;

		forEach.l("outer")(ARR, (_, idx) => {
			return forEach(ARR, _ => {
				innerCount++;

				if (idx == 2)
					return forEach.CONTINUE("outer");
			}).done(_ => {
				outerCount++;
			});
		});

		expect(outerCount).toBe(3);
		// 4 * ARR[4] - 3, because on the third loop the inner loop is broken after one iteration
		expect(innerCount).toBe(13);
	});

	test("continues nested forEach fully", () => {
		let outerCount = 0,
			innerCount = 0;

		forEach(ARR, (_, idx) => {
			outerCount++;

			return forEach(ARR, _ => {
				if (idx == 2)
					return forEach.CONTINUE_ALL;

				innerCount++;
			});
		});

		expect(outerCount).toBe(3);
		expect(innerCount).toBe(8);	// 2 * ARR[4]
	});
});
