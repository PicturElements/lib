import { isValidIdentifier } from "./is";
import {
	composeOptionsTemplates,
	createOptionsObject
} from "./internal/options";
import parseBranchedConfig from "./parse-branched-config";
import hasOwn from "./has-own";

// Utility for creating chainable functions
// Usage:
//
// Node object:
// runtime: function
// invoke: function
// branch: NodeObject | <string|NodeObject|function>[]
// branchPassive: NodeObject | <string|NodeObject|function>[]
// group: string
// name: string
// passive: boolean
//
// runtime:
// Creates a runtime object for the chainable function if one is not already defined
//
// invoke:
// Performs an action with the current runtime and passed arguments
// The return value is not returned from the chain unless the handler
// is located at a leaf node
//
// branch:
// Defines chainable steps
// If an object, all non-key property entries are added as chainable steps
// If an entry points at a string value, a lookup will be performed looking for
// a group with the given name, or a step defined at a location defined by an accessor
// If an array, the same will apply, but node objects defined within them must be named
//
// branchPassive:
// Defines chainable steps available on the step without need for invocation
// If a step is defined as passive, branch and branchPassive are interchangeable
//
// group:
// Denotes a node object as a reusable group that can be referenced
//
// name:
// Denotes a node object as a reusable node that can be referenced
//
// passive:
// Marks a node as passive, meaning it cannot be invoked
//
// -------
//
// Options:
// closed
//
// closed:
// The chainable object is a closed system. As such, runtime handling can be optimized

const ACCESS_TOKEN = Object.freeze({ description: "tells pinger to access property" }),
	SKIP_SELF_ACCESS = Object.freeze({ description: "tells pinger to skip property access" }),
	ACCESS_TOKEN_ARGS = [ACCESS_TOKEN];

const OPTIONS_TEMPLATES = composeOptionsTemplates({
	closed: true
});

export default function mkChainable(name, struct, options) {
	if (name != "string") {
		options = struct;
		struct = name;
		name = null;
	}

	struct = parseBranchedConfig(
		struct,
		{
			schema: {
				runtime: { type: "function", default: null },
				init: { type: "function", default: null },
				invoke: { type: "function", default: null },
				access: { type: "function", default: null },
				passive: { type: "boolean", default: false },
				defer: { type: "boolean", default: false }
			},
			scopes: {
				branch: ["b"],
				branchPassive: ["bp", "p"],
				group: ["g"]
			},
			groupKey: "group",
			defaultScope: "branch",
			init: {
				step: ensureDeferrable,
				leaf: (n, node, scope) => {
					ensureDeferrable(n);
					if (typeof node != "function")
						return;

					n.invoke = scope.name == "branch" ? node : null;
					n.access = scope.name == "branch" ? null : node;
				}
			}
		},
		msg => { throw new Error(`Cannot create chainable: ${msg}`); }
	);
	options = createOptionsObject(options, OPTIONS_TEMPLATES);

	const getterQueue = [];
	let store,
		pingInit,
		pingStep,
		pingTerminate;

	if (options.closed) {
		store = {
			initialized: true,
			deferNode: null,
			runtime: {}
		};

		pingInit = (node, out) => (...args) => {
			store.initialized = false;
			store.deferNode = null;
			store.runtime = {};

			if (args[0] != ACCESS_TOKEN || args[1] != SKIP_SELF_ACCESS)
				runPing(node, store, ACCESS_TOKEN_ARGS);
			runPing(node, store, args);
			return out;
		};

		pingStep = (node, out) => (...args) => {
			runPing(node, store, args);
			return out;
		};

		pingTerminate = node => (...args) => {
			return runPing(node, store, args);
		};
	} else {
		store = {
			stack: []
		};

		pingInit = (node, out) => (...args) => {
			const frame = {
				initialized: false,
				deferNode: null,
				runtime: {}
			};
			store.stack.push(frame);

			if (args[0] != ACCESS_TOKEN || args[1] != SKIP_SELF_ACCESS)
				runPing(node, store, ACCESS_TOKEN_ARGS);
			runPing(node, frame, args);
			return out;
		};

		pingStep = (node, out) => (...args) => {
			const frame = store.stack[store.stack.length - 1];
			runPing(node, frame, args);
			return out;
		};

		pingTerminate = node => (...args) => {
			const frame = store.stack.pop();
			return runPing(node, frame, args);
		};
	}

	const runPing = (node, frame, args) => {
		if (frame.deferNode) {
			if (node.uid != frame.deferNode.uid || args[0] == ACCESS_TOKEN) {
				applyPingPre(frame.deferNode, frame, []);
				frame.deferNode.access(frame.runtime);
			}

			frame.deferNode = null;
		}

		if (node.defer && args[0] == ACCESS_TOKEN) {
			frame.deferNode = node;
			return;
		}

		applyPingPre(node, frame, args);

		if (args[0] == ACCESS_TOKEN) {
			if (node.access)
				return node.access(frame.runtime);

			return;
		}
		
		if (node.invoke)
			return node.invoke(frame.runtime, ...args);
	};

	const applyPingPre = (node, frame, args) => {
		if (node.runtime)
			frame.runtime = node.runtime(frame.runtime, ...args) || frame.runtime;

		if (node.init && !frame.initialized) {
			frame.initialized = true;
			frame.runtime = node.init(frame.runtime, ...args) || frame.runtime;
		}
	};

	const getPinger = node => {
		if (node.type == "leaf")
			return pingTerminate;

		return node.uid == struct.uid ?
			pingInit :
			pingStep;
	};

	const getPingerType = node => {
		if (node.type == "leaf")
			return "terminate";

		return node.uid == struct.uid ?
			"init" :
			"step";
	};

	const getName = node => {
		if (node.type == "wrapper")
			return node.referenceNode.name;

		return node.name;
	};

	const construct = node => {
		let uNode,
			useCached = false;

		if (node.type == "wrapper") {
			uNode = Object.assign({}, node.node);
			uNode.name = node.referenceNode.name;
			uNode.uid = node.referenceNode.uid;
			node = node.node;
		} else
			uNode = Object.assign({}, node);

		let junction = {},
			getterPartition = {
				data: [],
				targets: []
			};

		if (hasOwn(node, "cache")) {
			useCached = true;
			junction = node.cache.junction;
			getterPartition = node.cache.getterPartition;
		} else
			getterQueue.push(getterPartition);

		const nodeName = name || node.name || "chain";
		if (!isValidIdentifier(nodeName))
			throw new Error(`Cannot create chainable: invalid name '${nodeName}'`);
		
		const resolve = n => {
			return Function(
				"node",
				"ping",
				"out",
				`return function ${nodeName}() { return ping(node, out).apply(null, arguments); }`
			)(n, getPinger(n), junction);
		};

		node.resolve = resolve;
		node.cache = {
			junction,
			getterPartition
		};
		const resolved = resolve(uNode),
			coreData = node.passive ?
				junction :
				resolved;

		if (useCached) {
			getterPartition.targets.push({
				resolved,
				type: getPingerType(uNode)
			});

			return {
				resolved,
				coreData,
				node: uNode
			};
		}

		if (useCached || node.type == "leaf") {
			return {
				resolved,
				coreData,
				node: uNode
			};
		}

		const branch = node.passive ?
				node.branch.concat(node.branchPassive) :
				node.branch,
			branchGetters = {};

		for (let i = 0, l = branch.length; i < l; i++) {
			const constructed = construct(branch[i]),
				descriptor = {
					enumerable: true,
					configurable: false,
				};

			if (hasOwn(branchGetters, constructed.node.name))
				throw new Error(`Cannot create chainable: duplicate branch '${constructed.node.name}' in passive node`);

			if (constructed.node.passive || i >= node.branch.length)
				descriptor.get = _ => constructed.resolved(ACCESS_TOKEN);
			else {
				descriptor.get = _ => {
					pingStep(constructed.node, constructed.resolved)(ACCESS_TOKEN);
					return constructed.resolved;
				};
			}

			branchGetters[constructed.node.name] = descriptor;
		}

		Object.defineProperties(junction, branchGetters);

		if (!node.passive) {
			const branchPassive = node.branchPassive;
			for (let i = 0, l = branchPassive.length; i < l; i++) {
				const constructed = construct(branchPassive[i]);
				getterPartition.data.push(constructed);
			}

			if (branchPassive.length) {
				getterPartition.targets.push({
					resolved,
					type: getPingerType(uNode)
				});
			}
		}

		return {
			resolved,
			coreData,
			node: uNode
		};
	};

	const cnstr = construct(struct);

	for (let a = 0, l = getterQueue.length; a < l; a++) {
		const partition = getterQueue[a];

		if (!partition.data.length)
			continue;

		for (let b = 0, l2 = partition.targets.length; b < l2; b++) {
			const { resolved, type } = partition.targets[b],
				getters = {};

			for (let c = 0, l3 = partition.data.length; c < l3; c++) {
				const constructed = partition.data[c],
					name = constructed.node.name,
					descriptor = {
						enumerable: true,
						configurable: false,
						get: constructed.resolved
					};
	
				if (typeof resolved == "function") {
					if (!constructed.node.passive || typeof constructed.resolved != "function") {
						descriptor.get = _ => {
							resolved(ACCESS_TOKEN);
							return constructed.resolved;
						};
					} else if (type == "init") {
						descriptor.get = _ => {
							resolved(ACCESS_TOKEN, SKIP_SELF_ACCESS);
							return constructed.resolved(ACCESS_TOKEN);
						};
					} else
						descriptor.get = _ => constructed.resolved(ACCESS_TOKEN);
				}
	
				getters[name] = descriptor;
			}

			Object.defineProperties(resolved, getters);
		}
	}

	if (struct.passive) {
		const branches = struct.branch.concat(struct.branchPassive),
			getters = {};

		for (let i = 0, l = branches.length; i < l; i++) {
			const name = getName(branches[i]);
			getters[name] = {
				enumerable: true,
				configurable: false,
				get: _ => cnstr.resolved(ACCESS_TOKEN, SKIP_SELF_ACCESS)[name]
			};
		}

		return Object.defineProperties({}, getters);
	}

	return cnstr.resolved;
}

function ensureDeferrable(node) {
	if (!node.defer)
		return;

	if (!node.branchPassive.length || node.passive || node.type != "step")
		node.defer = false;
}
