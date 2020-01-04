import {
	hasOwn,
	isObject,
	filterMut,
	resolveArgs,
	queryFilterMut,
	composeOptionsTemplates
} from "@qtxr/utils";
import { Keys } from "@qtxr/ds";
import Hook from "./hook";
import {
	addOptionsPartition,
	opt
} from "./common/options";

// TODO: in next major version, rename nickname to identifier

const reservedFields = {
	last: true,
	keys: true
};

const hookParams = [
	{ name: "partitionName", type: "string", required: true },
	{ name: "handler", type: "function", required: true },
	{ name: "nickname", type: ["string", "symbol"], default: null },
	{ name: "namespace", type: ["string", "symbol"], default: null },
	{ name: "ttl", type: "number", default: Infinity },
	{ name: "guard", type: "function", default: null },
	{ name: "argTemplate", type: "string", default: null }
];

const hookNSParams = [
	{ name: "namespace", type: ["string", "symbol"], required: true },
	{ name: "partitionName", type: "string", required: true },
	{ name: "handler", type: "function", required: true },
	{ name: "nickname", type: ["string", "symbol"], default: null },
	{ name: "ttl", type: "number", default: Infinity },
	{ name: "guard", type: "function", default: null },
	{ name: "argTemplate", type: "string", default: null }
];

const unhookParams = [
	{ name: "instance", type: Hook, default: null },
	{ name: "partitionName", type: "string", default: null},
	{ name: "handler", type: "function", default: null },
	{ name: "nickname", type: ["string", "symbol"], default: null },
	{ name: "namespace", type: ["string", "symbol"], default: null },
	{ name: "ttl", type: "number", default: null },
	{ name: "guard", type: "function", default: null },
	{ name: "argTemplate", type: "string", default: null }
];

const unhookNSParams = [
	{ name: "namespace", type: ["string", "symbol"], required: true },
	{ name: "instance", type: Hook, default: null },
	{ name: "partitionName", type: "string", default: null },
	{ name: "handler", type: "function", default: null },
	{ name: "nickname", type: ["string", "symbol"], default: null },
	{ name: "ttl", type: "number", default: null },
	{ name: "guard", type: "function", default: null },
	{ name: "argTemplate", type: "string", default: null }
];

const PromiseImpl = typeof Promise == "undefined" ?
	class {} :
	Promise;

const optionsTemplates = composeOptionsTemplates({
	noOwnerArg: true
});

const HOOKABLE_METHODS = {
	hook(...args) {
		addHook(this, hookParams, args);
		return this;
	},

	hookNS(ns, ...args) {
		addHook(this, hookNSParams, [ns, ...args]);
		return this;
	},

	hookAll(hooks, forcedName) {
		const dispatch = (partitionName, d) => {
			const handler = typeof d == "function" ? d : d.handler;
			this.hook(partitionName, handler, d.nickname, d.namespace, d.ttl, d.guard);
		};

		if (Array.isArray(hooks)) {
			for (let i = 0, l = hooks.length; i < l; i++)
				dispatch(forcedName || hooks[i].name, hooks[i]);
		} else if (isObject(hooks)) {
			for (const k in hooks) {
				if (!hooks.hasOwnProperty(k))
					continue;
				
				if (Array.isArray(hooks[k]))
					this.hookAll(hooks[k], k);
				else
					dispatch(k, hooks[k]);
			}
		}

		return this;
	},

	unhook(...args) {
		removeHook(this, unhookParams, args);
		return this;
	},

	unhookNS(...args) {
		removeHook(this, unhookNSParams, args);
		return this;
	},

	callHooks(partitionName, ...args) {
		this.hooks.keys.forEach(partitionName, (key, keyType) => {
			const hooks = this.hooks[key],
				contextArgs = {
					key: partitionName,
					keyType
				};
			
			filterMut(hooks, hook => {
				if (hook.spent)
					return false;
	
				if (hook.proceed(args, contextArgs)) {
					hook.handle(args, contextArgs);
					return hook.decTTL() > 0;
				} else
					return true;
			});

			if (!hooks.length) {
				delete this.hooks[key];
				this.hooks.keys.delete(key);
			}
		});

		return this;
	},

	clearHooks() {
		for (const k in this.hooks) {
			if (this.hooks.hasOwnProperty(k) && !reservedFields.hasOwnProperty(k)) {
				delete this.hooks[k];
				this.hooks.keys.delete(k);
			}
		}

		return this;
	},

	clearHooksNS(ns) {
		this.forEachHookPartition((partition, key) => {
			filterMut(partition, h => h.namespace != ns);

			if (!partition.length) {
				delete this.hooks[key];
				this.hooks.keys.delete(key);
			}
		});
		
		return this;
	},

	forEachHookPartition(callback) {
		if (!callback)
			return;

		for (const k in this.hooks) {
			if (!this.hooks.hasOwnProperty(k) || reservedFields.hasOwnProperty(k))
				continue;

			callback(this.hooks[k], k, this.hooks);
		}
	},

	getHookPartition(partitionName) {
		if (!this.hooks.hasOwnProperty(partitionName) || reservedFields.hasOwnProperty(partitionName))
			return null;

		return this.hooks[partitionName];
	}
};

export default class Hookable {
	constructor(options) {
		addOptionsPartition(this, options, "hookable", optionsTemplates);

		Object.defineProperty(this, "hooks", {
			value: {
				last: null,
				keys: new Keys()
			},
			configurable: false,
			enumerable: true,
			writable: false
		});
	}

	static promised(options, ...args) {
		return PromisedHookable.create(options, ...args);
	}
}

Object.assign(Hookable.prototype, HOOKABLE_METHODS);

class PromisedHookable extends PromiseImpl {
	constructor(executor, options) {
		super(executor);

		addOptionsPartition(this, options, "hookable", optionsTemplates);

		Object.defineProperty(this, "hooks", {
			value: {
				last: null,
				keys: new Keys()
			},
			configurable: false,
			enumerable: true,
			writable: false
		});
	}

	static promised(options, ...args) {
		return this.create(options, ...args);
	}

	static create(options, ...args) {
		let dispatchPromise = _ => console.warn("Promise based functionality is not supported");

		const inst = new this((resolve, reject) => {
			let status = "pending";

			dispatchPromise = (actionOrConf, confOrPayload) => {
				let conf = actionOrConf;

				if (typeof actionOrConf == "string") {
					conf = {
						action: actionOrConf,
						payload: confOrPayload
					};
				}

				if (!isObject(conf)) {
					console.warn("Cannot dispatch promise: configuration is not an object");
					return this;
				} else if (status != "pending") {
					console.warn(`Cannot dispatch promise: promise is already ${status}`);
					return this;
				}

				if (conf.action == "reject" || conf.type == "reject") {
					status = "rejected";

					if (hasOwn(conf, "reason"))
						reject(conf.reason);
					else if (hasOwn(conf, "error"))
						reject(conf.error);
					else
						reject(conf.payload);
				} else {
					status = "fulfilled";

					if (hasOwn(conf, "value"))
						resolve(conf.value);
					else if (hasOwn(conf, "data"))
						resolve(conf.data);
					else
						resolve(conf.payload);
				}

				return this;
			};
		}, options, ...args);

		inst.dispatchPromise = dispatchPromise;
		return inst;
	}
}

Object.assign(PromisedHookable.prototype, HOOKABLE_METHODS);

function addHook(inst, paramMap, args) {
	const data = resolveArgs(args, paramMap, "allowSingleSource"),
		partitionName = data.partitionName;

	if (reservedFields.hasOwnProperty(partitionName))
		return console.warn(`Cannot set hooks at '${partitionName}' because it's a reserved field`);

	const hooks = inst.hooks.hasOwnProperty(partitionName) ? inst.hooks[partitionName] : [];
	inst.hooks[partitionName] = hooks;

	const hook = new Hook(inst, data);
	inst.hooks.keys.add(partitionName);
	inst.hooks.last = hook;
	hooks.push(hook);
	return hook;
}

const ignoredQueryKeys = {
	rest: true
};

function removeHook(inst, paramMap, args) {
	const data = resolveArgs(args, paramMap, "allowSingleSource");

	if (data.instance) {
		inst.forEachHookPartition((partition, key) => {
			filterMut(partition, hook => hook != data.instance);

			if (!partition.length) {
				delete inst.hooks[key];
				inst.hooks.keys.delete(key);
			}
		});

		return;
	}

	if (data.partitionName) {
		const partition = inst.getHookPartition(data.partitionName);

		if (partition)
			filterPartition(partition, data.partitionName);
	} else
		inst.forEachHookPartition(filterPartition);

	function filterPartition(partition, key) {
		queryFilterMut(partition, data, "invert", {
			noNullish: true,
			guard: parsedKey => !ignoredQueryKeys.hasOwnProperty(parsedKey.key)
		});

		if (!partition.length) {
			delete inst.hooks[key];
			inst.hooks.keys.delete(key);
		}
	}
}

export {
	PromisedHookable
};
