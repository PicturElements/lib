import infill from "../src/infill";

it("works with no modifiers", () => {
	expect(infill({
		alphabet: {
			a: null,
			b: null
		}
	}, {
		alphabet: {
			a: 1,
			b: 2,
			c: 3
		},
		arr: [1, 2, 3]
	})).toStrictEqual({
		alphabet: {
			a: 1,
			b: 2,
			c: 3
		},
		arr: [1, 2, 3]
	});
});

describe("stock modifiers work", () => {
	// applies infill on every object at the same level
	test("every", () => {
		expect(infill({
			a: {},
			b: {
				nest: {
					c: {},
					d: {}
				}
			}
		}, {
			"@every": {
				num: 42,
				nest: {
					"@every": {
						str: "str"
					},
					bool: true
				}
			}
		})).toStrictEqual({
			a: {
				num: 42,
				nest: {
					bool: true
				}
			},
			b: {
				num: 42,
				nest: {
					c: {
						str: "str"
					},
					d: {
						str: "str"
					},
					bool: true
				}
			}
		});
	});

	// only applies data to the set keys of the target
	test("lazy with outer directive", () => {
		expect(infill({
			a: {},
			b: {
				moreLazy: {
					d: null,
					e: null
				}
			}
		}, {
			"@lazy": {
				a: {
					num: 42,
				},
				b: {
					str: "str",
					moreLazy: {
						"@lazy": {
							d: 1,
							e: 2,
							f: 3
						}
					}
				},
				c: {
					bool: true
				}
			}
		})).toStrictEqual({
			a: {
				num: 42,
			},
			b: {
				str: "str",
				moreLazy: {
					d: 1,
					e: 2
				}
			}
		});
	});

	test("lazy with inline directive", () => {
		expect(infill({
			alphabet: {
				a: null,
				b: null
			}
		}, {
			"@lazy:alphabet": {
				a: 1,
				b: 2,
				c: 3
			}
		})).toStrictEqual({
			alphabet: {
				a: 1,
				b: 2
			}
		});
	});

	// formats data with a provided callback
	test("format", () => {
		expect(infill({
			alphabet: ["a", "b", "c"]
		}, {
			"@format:alphabet"(target) {
				return target.map(alpha => alpha.toUpperCase());
			}
		})).toStrictEqual({
			alphabet: ["A", "B", "C"]
		});
	});

	// edits data one by one with a provided callback
	test("forEach", () => {
		expect(infill({
			alphabet: [
				{
					alpha: "a"
				}, {
					alpha: "b"
				}, {
					alpha: "c"
				}
			]
		}, {
			"@forEach:alphabet"(alphaObj) {
				alphaObj.alpha = alphaObj.alpha.toUpperCase();
			}
		})).toStrictEqual({
			alphabet: [
				{
					alpha: "A"
				}, {
					alpha: "B"
				}, {
					alpha: "C"
				}
			]
		});
	});

	// maps data with a provided callback
	test("map", () => {
		expect(infill({
			alphabet: { a: "a", b: "b", c: "c" }
		}, {
			"@map:alphabet"(alpha) {
				return alpha.toUpperCase();
			}
		})).toStrictEqual({
			alphabet: { a: "A", b: "B", c: "C" }
		});
	});
});

it("supports temporary setting / overriding of modifiers", () => {
	expect(infill({
		goodData: [1, 2, 3, 4]
	}, {
		"@map:goodData"(num) {
			return num * 2;
		}
	}, {
		modifiers: {
			map({ target, parentTarget, source: mapper, key }) {
				parentTarget.goodData = "data ruined";
				parentTarget[`${key}ButNotAnymore`] = target.map(num => `garbage ${mapper(num)}`);
			}
		}
	})).toStrictEqual({
		goodData: "data ruined",
		goodDataButNotAnymore: [
			"garbage 2",
			"garbage 4",
			"garbage 6",
			"garbage 8"
		]
	});

	// Should not have affected @map
	expect(infill({
		alphabet: { a: "a", b: "b", c: "c" }
	}, {
		"@map:alphabet"(alpha) {
			return alpha.toUpperCase();
		}
	})).toStrictEqual({
		alphabet: { a: "A", b: "B", c: "C" }
	});
});
