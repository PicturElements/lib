import {
	hasOwn,
	isObject,
	filterMut,
	resolveArgs,
	queryFilterMut,
	composeOptionsTemplates
} from "@qtxr/utils";
import {
	Manage,
	Options
} from "../common";
import { Keys } from "@qtxr/ds";
import DeferredPromise from "../deferred-promise";
import Hook from "./hook";

// TODO: in next major version, rename nickname to identifier

const reservedFields = {
	last: true,
	keys: true
};

const hookParams = [
	{ name: "partitionName", alias: "name", type: "string", required: true },
	{ name: "handler", type: "function", required: true },
	{ name: "nickname", alias: "identifier", type: "string|symbol", default: null },
	{ name: "namespace", type: "string|symbol", default: null },
	{ name: "ttl", type: "number", default: Infinity },
	{ name: "guard", type: "function", default: null },
	{ name: "argTemplate", type: "string", default: null }
];

const hookNSParams = [
	{ name: "namespace", type: "string|symbol", required: true },
	{ name: "partitionName", alias: "name", type: "string", required: true },
	{ name: "handler", type: "function", required: true },
	{ name: "nickname", alias: "identifier", type: "string|symbol", default: null },
	{ name: "ttl", type: "number", default: Infinity },
	{ name: "guard", type: "function", default: null },
	{ name: "argTemplate", type: "string", default: null }
];

const unhookParams = [
	{ name: "instance", type: Hook, default: null },
	{ name: "partitionName", alias: "name", type: "string", default: null},
	{ name: "handler", type: "function", default: null },
	{ name: "nickname", alias: "identifier", type: "string|symbol", default: null },
	{ name: "namespace", type: "string|symbol", default: null },
	{ name: "ttl", type: "number", default: null },
	{ name: "guard", type: "function", default: null },
	{ name: "argTemplate", type: "string", default: null }
];

const unhookNSParams = [
	{ name: "namespace", type: "string|symbol", required: true },
	{ name: "instance", type: Hook, default: null },
	{ name: "partitionName", alias: "name", type: "string", default: null },
	{ name: "handler", type: "function", default: null },
	{ name: "nickname", alias: "identifier", type: "string|symbol", default: null },
	{ name: "ttl", type: "number", default: null },
	{ name: "guard", type: "function", default: null },
	{ name: "argTemplate", type: "string", default: null }
];

export default class Hookable extends DeferredPromise {
	constructor(options) {
		super(options);
		Manage.instantiate(Hookable, this, options);
	}

	[Manage.CONSTRUCTOR]() {
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

	hook(...args) {
		addHook(this, hookParams, args);
		return this;
	}

	hookNS(ns, ...args) {
		addHook(this, hookNSParams, [ns, ...args]);
		return this;
	}

	hookAll(hooks, forcedName) {
		const dispatch = (partitionName, d) => {
			const handler = typeof d == "function" ? d : d.handler;

			this.hook(
				partitionName,
				handler,
				d.nickname,
				d.namespace,
				d.ttl,
				d.guard
			);
		};

		if (Array.isArray(hooks)) {
			for (let i = 0, l = hooks.length; i < l; i++)
				dispatch(forcedName || hooks[i].name, hooks[i]);
		} else if (isObject(hooks)) {
			for (const k in hooks) {
				if (!hasOwn(hooks, k))
					continue;
				
				if (Array.isArray(hooks[k]))
					this.hookAll(hooks[k], k);
				else
					dispatch(k, hooks[k]);
			}
		}

		return this;
	}

	unhook(...args) {
		removeHook(this, unhookParams, args);
		return this;
	}

	unhookNS(...args) {
		removeHook(this, unhookNSParams, args);
		return this;
	}

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
	}

	clearHooks() {
		for (const k in this.hooks) {
			if (hasOwn(this.hooks, k) && !hasOwn(reservedFields, k)) {
				delete this.hooks[k];
				this.hooks.keys.delete(k);
			}
		}

		return this;
	}

	clearHooksNS(ns) {
		this.forEachHookPartition((partition, key) => {
			filterMut(partition, h => h.namespace != ns);

			if (!partition.length) {
				delete this.hooks[key];
				this.hooks.keys.delete(key);
			}
		});
		
		return this;
	}

	forEachHookPartition(callback) {
		if (!callback)
			return;

		for (const k in this.hooks) {
			if (!hasOwn(this.hooks, k) || hasOwn(reservedFields, k))
				continue;

			callback(this.hooks[k], k, this.hooks);
		}
	}

	getHookPartition(partitionName) {
		if (!hasOwn(this.hooks, partitionName) || hasOwn(reservedFields, partitionName))
			return null;

		return this.hooks[partitionName];
	}

	// Legacy
	static create(...args) {
		return new this(...args);
	}

	static promised(...args) {
		return this.create(...args);
	}
}

const PromisedHookable = Hookable;

function addHook(inst, paramMap, args) {
	const data = resolveArgs(args, paramMap, "allowSingleSource"),
		partitionName = data.partitionName;

	if (hasOwn(reservedFields, partitionName))
		return console.warn(`Cannot set hooks at '${partitionName}' because it's a reserved field`);

	const hooks = hasOwn(inst.hooks, partitionName) ?
		inst.hooks[partitionName] :
		[];
	inst.hooks[partitionName] = hooks;

	const hook = new Hook(
		inst,
		data,
		Options.mkResolver(Hookable, inst)
	);
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
			guard: parsedKey => !hasOwn(ignoredQueryKeys, parsedKey.key)
		});

		if (!partition.length) {
			delete inst.hooks[key];
			inst.hooks.keys.delete(key);
		}
	}
}

Manage.declare(Hookable, {
	name: "Hookable",
	namespace: "hookable",
	extends: DeferredPromise,
	proto: ["hook", "hookNS", "hookAll", "unhook", "unhookNS", "callHooks", "clearHooks", "clearHooksNS", "forEachHookPartition", "getHookPartition"],
	static: ["create", "promised"],
	optionsTemplates: composeOptionsTemplates({
		noOwnerArg: true
	})
});

export {
	PromisedHookable
};
