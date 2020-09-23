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

const ACCESS_TOKEN = {};
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
				passive: { type: "boolean", default: false }
			},
			scopes: {
				branch: ["b"],
				branchPassive: ["bp", "p"],
				group: ["g"]
			},
			groupKey: "group",
			defaultScope: "branch",
			init: {
				leaf: (n, f, scope) => {
					n.invoke = scope.name == "branch" ? f : null;
					n.access = scope.name == "branch" ? null : f;
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
			runtime: {}
		};

		pingInit = (node, out) => (...args) => {
			store.initialized = false;
			store.runtime = {};
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
				runtime: {}
			};
			store.stack.push(frame);

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
		if (node.runtime)
			frame.runtime = node.runtime(frame.runtime, ...args) || frame.runtime;

		if (node.init && !frame.initialized) {
			frame.initialized = true;
			frame.runtime = node.init(frame.runtime, ...args) || frame.runtime;
		}

		if (args[0] == ACCESS_TOKEN) {
			if (node.access)
				return node.access(frame.runtime);

			return;
		}
		
		if (node.invoke)
			return node.invoke(frame.runtime, ...args);

		return;
	};

	const getPinger = node => {
		if (node.type == "leaf")
			return pingTerminate;

		return node.uid == struct.uid ?
			pingInit :
			pingStep;
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
			getterPartition.targets.push(resolved);

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

			if (branchPassive.length)
				getterPartition.targets.push(resolved);
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
			const target = partition.targets[b],
				getters = {};

			for (let c = 0, l3 = partition.data.length; c < l3; c++) {
				const constructed = partition.data[c],
					name = constructed.node.name,
					descriptor = {
						enumerable: true,
						configurable: false,
						get: constructed.resolved
					};
	
				if (typeof target == "function") {
					if (!constructed.node.passive || typeof constructed.resolved != "function") {
						descriptor.get = _ => {
							target(ACCESS_TOKEN);
							return constructed.resolved;
						};
					} else {
						descriptor.get = _ => {
							target(ACCESS_TOKEN);
							return constructed.resolved(ACCESS_TOKEN);
						};
					}
				}
	
				getters[name] = descriptor;
			}

			Object.defineProperties(target, getters);
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
				get: _ => cnstr.resolved(ACCESS_TOKEN)[name]
			};
		}

		return Object.defineProperties({}, getters);
	}

	return cnstr.resolved;
}
