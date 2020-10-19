import mkChainable from "../src/mk-chainable";

const TRACE = [];

const init = ctx => ({
	thisShouldExist: true
});
const access = (ctx, runtime) => TRACE.push(`acc ${ctx.name}`) && runtime;
const invoke = (ctx, runtime) => TRACE.push(`ivk ${ctx.name}`) && runtime;

const mkRunner = (config, options) => {
	const chainable = mkChainable(config, options);

	return callback => {
		TRACE.length = 0;
		const response = callback(chainable);

		if (!response || !response.thisShouldExist)
			return null;

		return TRACE.join(", ");
	};
};

const mkExpectRunner = (config, options) => {
	const run = mkRunner(config, options);

	return (callback, mode = "standard") => {
		switch (mode) {
			case "err":
				return expect(_ => run(callback));

			case "standard":
				return expect(run(callback));
		}
	};
};

describe("correct construction and execution of chainable properties and methods", () => {
	const config = {
		name: "root",
		init,
		access,
		invoke,
		branch: {
			group: "group",
			rootRef: "root",
			functionDefinition: invoke,
			nodeObjectDefinition: {
				access,
				invoke,
				branch: {
					deepInvoke: invoke,
					rootRef: "root"
				},
				branchPassive: {
					deepAccess: access
				}
			},
			passiveNodeObjectDefinition: {
				passive: true,
				access,
				// This should work as in passive mode,
				// branch and branchPassive are synonymous
				branch: {
					deepInvoke2: invoke
				},
				branchPassive: "group"
			}
		},
		branchPassive: {
			rootRefPassive: "root",
			deep: {
				passive: true,
				access,
				branchPassive: {
					a: access,
					b: {
						invoke
					},
					c: {
						access
					},
					selfRefRef: "passive:root.deep.selfRef",
					selfRef: "bp:root.deep",
					root: "root"
				}
			},
			bareSource: {
				access,
				branch: {
					rootRef: "root"
				},
				branchPassive: {
					d: access
				}
			}, 
			bare: {
				extends: ["root.bareSource"],
				invoke,
				alias: "bare2"
			}
		}
	};

	[
		{
			target: "closed deferred form",
			options: "closed|defer|withContext"
		},
		{
			target: "open deferred form",
			options: "defer|withContext"
		}
	].forEach(({ target, options }) => {
		describe(target, () => {
			const exp = mkExpectRunner(config, options);

			it("correctly runs chained calls", () => {
				exp(c => c().functionDefinition())
					.toBe("ivk root, ivk functionDefinition");
				exp(c => c().nodeObjectDefinition().deepInvoke())
					.toBe("ivk root, ivk nodeObjectDefinition, ivk deepInvoke");
			});

			it("correctly runs chained accesses", () => {
				exp(c => c.deep.a)
					.toBe("acc root, acc deep, acc a");
				exp(c => c.deep.c)
					.toBe("acc root, acc deep, acc c");
			});

			it("correctly handles mixed accesses and calls", () => {
				exp(c => c.deep.b())
					.toBe("acc root, acc deep, ivk b");
				exp(c => c().passiveNodeObjectDefinition.deepInvoke2())
					.toBe("ivk root, acc passiveNodeObjectDefinition, ivk deepInvoke2");
				exp(c => c().passiveNodeObjectDefinition.functionDefinition())
					.toBe("ivk root, acc passiveNodeObjectDefinition, ivk functionDefinition");
			});

			it("correctly handles references", () => {
				exp(c => c.deep.selfRef.selfRef.a)
					.toBe("acc root, acc deep, acc selfRef, acc selfRef, acc a");
				exp(c => c.deep.selfRefRef.selfRef.a)
					.toBe("acc root, acc deep, acc selfRefRef, acc selfRef, acc a");
				exp(c => c.deep.root.deep.selfRefRef.a)
					.toBe("acc root, acc deep, acc root, acc deep, acc selfRefRef, acc a");
				exp(c => c().nodeObjectDefinition().rootRef.deep.a)
					.toBe("ivk root, ivk nodeObjectDefinition, acc rootRef, acc deep, acc a");
			});

			it("correctly handles extensions and aliases", () => {
				exp(c => c.bareSource(), "err")
					.toThrow();

				exp(c => c.bareSource.d)
					.toBe("acc root, acc bareSource, acc d");
				exp(c => c.bare().rootRef.deep.a)
					.toBe("acc root, ivk bare, acc rootRef, acc deep, acc a");

				exp(c => c.bare2().rootRef.deep.a)
					.toBe("acc root, ivk bare2, acc rootRef, acc deep, acc a");
			});
		});
	});

	[
		{
			target: "closed non-deferred form",
			options: "closed|withContext"
		},
		{
			target: "open non-deferred form",
			options: "withContext"
		}
	].forEach(({ target, options }) => {
		describe(target, () => {
			const exp = mkExpectRunner(config, options);

			it("correctly runs chained calls", () => {
				exp(c => c().functionDefinition())
					.toBe("acc root, ivk root, ivk functionDefinition");
				exp(c => c().nodeObjectDefinition().deepInvoke())
					.toBe("acc root, ivk root, acc nodeObjectDefinition, ivk nodeObjectDefinition, ivk deepInvoke");
			});

			it("correctly runs chained accesses", () => {
				exp(c => c.deep.a)
					.toBe("acc root, acc deep, acc a");
				exp(c => c.deep.c)
					.toBe("acc root, acc deep, acc c");
			});

			it("correctly handles mixed accesses and calls", () => {
				exp(c => c.deep.b())
					.toBe("acc root, acc deep, ivk b");
				exp(c => c().passiveNodeObjectDefinition.deepInvoke2())
					.toBe("acc root, ivk root, acc passiveNodeObjectDefinition, ivk deepInvoke2");
				exp(c => c().passiveNodeObjectDefinition.functionDefinition())
					.toBe("acc root, ivk root, acc passiveNodeObjectDefinition, ivk functionDefinition");
			});

			it("correctly handles references", () => {
				exp(c => c.deep.selfRef.selfRef.a)
					.toBe("acc root, acc deep, acc selfRef, acc selfRef, acc a");
				exp(c => c.deep.selfRefRef.selfRef.a)
					.toBe("acc root, acc deep, acc selfRefRef, acc selfRef, acc a");
				exp(c => c.deep.root.deep.selfRefRef.a)
					.toBe("acc root, acc deep, acc root, acc deep, acc selfRefRef, acc a");
				exp(c => c().nodeObjectDefinition().rootRef.deep.a)
					.toBe("acc root, ivk root, acc nodeObjectDefinition, ivk nodeObjectDefinition, acc rootRef, acc deep, acc a");
			});

			it("correctly handles extensions and aliases", () => {
				exp(c => c.bareSource(), "err")
					.toThrow();

				exp(c => c.bareSource.d)
					.toBe("acc root, acc bareSource, acc d");
				exp(c => c.bare().rootRef.deep.a)
					.toBe("acc root, acc bare, ivk bare, acc rootRef, acc deep, acc a");

				exp(c => c.bare2().rootRef.deep.a)
					.toBe("acc root, acc bare2, ivk bare2, acc rootRef, acc deep, acc a");
			});
		});
	});
});
