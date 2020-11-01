import {
	hasOwn,
	isObject,
	filterMut,
	resolveArgs,
	queryFilterMut,
	composeOptionsTemplates
} from "@qtxr/utils";
import { Keys } from "@qtxr/ds";
import {
	Manage,
	Options
} from "../common";
import DeferredPromise from "../deferred-promise";
import Hook from "./hook";

// TODO: in next major version, rename nickname to identifier

const RESERVED_FIELDS = {
	last: true,
	keys: true
};

const IGNORED_QUERY_KEYS = {
	rest: true
};

const HOOK_PARAMS = [
	{ name: "partitionName", alias: "name", type: "string", required: true },
	{ name: "handler", type: "function", required: true },
	{ name: "nickname", alias: "identifier", type: "string|symbol", default: null },
	{ name: "namespace", type: "string|symbol", default: null },
	{ name: "ttl", type: "number", default: Infinity },
	{ name: "guard", type: "function", default: null },
	{ name: "argTemplate", type: "string", default: null }
];

const HOOK_NS_PARAMS = [
	{ name: "namespace", type: "string|symbol", required: true },
	{ name: "partitionName", alias: "name", type: "string", required: true },
	{ name: "handler", type: "function", required: true },
	{ name: "nickname", alias: "identifier", type: "string|symbol", default: null },
	{ name: "ttl", type: "number", default: Infinity },
	{ name: "guard", type: "function", default: null },
	{ name: "argTemplate", type: "string", default: null }
];

const UNHOOK_PARAMS = [
	{ name: "instance", type: Hook, default: null },
	{ name: "partitionName", alias: "name", type: "string", default: null},
	{ name: "handler", type: "function", default: null },
	{ name: "nickname", alias: "identifier", type: "string|symbol", default: null },
	{ name: "namespace", type: "string|symbol", default: null },
	{ name: "ttl", type: "number", default: null },
	{ name: "guard", type: "function", default: null },
	{ name: "argTemplate", type: "string", default: null }
];

const UNHOOK_NS_PARAMS = [
	{ name: "namespace", type: "string|symbol", required: true },
	{ name: "instance", type: Hook, default: null },
	{ name: "partitionName", alias: "name", type: "string", default: null },
	{ name: "handler", type: "function", default: null },
	{ name: "nickname", alias: "identifier", type: "string|symbol", default: null },
	{ name: "ttl", type: "number", default: null },
	{ name: "guard", type: "function", default: null },
	{ name: "argTemplate", type: "string", default: null }
];

const PARAMS_MAP = {
	hook: HOOK_PARAMS,
	hookNS: HOOK_NS_PARAMS,
	unhook: UNHOOK_PARAMS,
	unhookNS: UNHOOK_NS_PARAMS
};

export default class Hookable extends DeferredPromise {
	constructor(options) {
		super(options);
		Manage.instantiate(Hookable, this, options);
	}

	[Manage.CONSTRUCTOR](opt) {
		Object.defineProperty(this, "hooks", {
			value: {
				last: null,
				keys: new Keys(opt("globCompileConfig"))
			},
			configurable: false,
			enumerable: true,
			writable: false
		});
	}

	hook(...args) {
		addHook(
			this,
			this.resolveHookArgs("hook", args)
		);
		return this;
	}

	hookNS(...args) {
		addHook(
			this,
			this.resolveHookArgs("hookNS", args)
		);
		return this;
	}

	hookAll(hooks, forcedName) {
		const dispatch = (partitionName, d) => {
			const handler = typeof d == "function" ?
				d :
				d.handler;

			this.hook(
				partitionName,
				handler,
				d.nickname,
				d.namespace,
				d.ttl,
				d.guard,
				d.argTemplate
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
		removeHook(
			this,
			this.resolveHookArgs("unhook", args)
		);
		return this;
	}

	unhookNS(...args) {
		removeHook(
			this,
			this.resolveHookArgs("unhookNS", args)
		);
		return this;
	}

	callHooks(partitionName, ...args) {
		return dispatch(this, partitionName, args);
	}

	callHooksWith(partitionName, resolver, alwaysResolve = false) {
		return dispatch(this, partitionName, resolver, alwaysResolve);
	}

	dispatchHooks(partitionName, resolver, alwaysResolve = false) {
		return dispatch(this, partitionName, resolver, alwaysResolve);
	}

	clearHooks() {
		for (const k in this.hooks) {
			if (hasOwn(this.hooks, k) && !hasOwn(RESERVED_FIELDS, k)) {
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
			if (!hasOwn(this.hooks, k) || hasOwn(RESERVED_FIELDS, k))
				continue;

			callback(this.hooks[k], k, this.hooks);
		}
	}

	getHookPartition(partitionName) {
		if (!hasOwn(this.hooks, partitionName) || hasOwn(RESERVED_FIELDS, partitionName))
			return null;

		return this.hooks[partitionName];
	}

	resolveHookArgs(type, args, options = null) {
		if (!hasOwn(PARAMS_MAP, type))
			throw new Error(`Cannot resolve hook arguments: unknown action type '${type}'`);

		options = options ?
			["allowSingleSource", options] :
			"allowSingleSource";

		return resolveArgs(args, PARAMS_MAP[type], options);
	}

	// Legacy
	static create(...args) {
		return new this(...args);
	}

	static promised(...args) {
		return this.create(...args);
	}
}

function addHook(inst, args) {
	const partitionName = args.partitionName;

	if (hasOwn(RESERVED_FIELDS, partitionName))
		return console.warn(`Cannot set hooks at '${partitionName}' because it's a reserved field`);

	const hooks = hasOwn(inst.hooks, partitionName) ?
		inst.hooks[partitionName] :
		[];
	inst.hooks[partitionName] = hooks;

	const hook = new Hook(
		inst,
		args,
		Options.mkResolver(Hookable, inst)
	);

	inst.hooks.keys.add(partitionName);
	inst.hooks.last = hook;
	hooks.push(hook);

	return hook;
}

function dispatch(inst, partitionName, argsOrResolver, alwaysResolve = false) {
	let argsResolver = typeof argsOrResolver == "function" ?
			argsOrResolver :
			null,
		args = argsOrResolver;

	if (!inst.hooks.keys.size)
		return inst;

	inst.hooks.keys.forEach(partitionName, (key, keyType) => {
		const hooks = inst.hooks[key],
			contextArgs = {
				key,
				keyType,
				partitionName,
				name: partitionName
			};

		if (hooks.length && argsResolver) {
			args = argsResolver(contextArgs);

			if (!Array.isArray(args))
				args = [];

			if (!alwaysResolve)
				argsResolver = null;
		}

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
			delete inst.hooks[key];
			inst.hooks.keys.delete(key);
		}
	});

	return inst;
}

function removeHook(inst, args) {
	args.originalHandler = args.handler;
	args.originalGuard = args.guard;
	delete args.handler;
	delete args.guard;

	if (args.instance) {
		inst.forEachHookPartition((partition, key) => {
			filterMut(partition, hook => hook != args.instance);

			if (!partition.length) {
				delete inst.hooks[key];
				inst.hooks.keys.delete(key);
			}
		});

		return;
	}

	const filterPartition = (partition, key) => {
		queryFilterMut(partition, args, "invert", {
			noNullish: true,
			plain: true,
			guard: parsedKey => !hasOwn(IGNORED_QUERY_KEYS, parsedKey.key)
		});

		if (!partition.length) {
			delete inst.hooks[key];
			inst.hooks.keys.delete(key);
		}
	};

	if (args.partitionName) {
		const partition = inst.getHookPartition(args.partitionName);

		if (partition)
			filterPartition(partition, args.partitionName);
	} else
		inst.forEachHookPartition(filterPartition);
}

Manage.declare(Hookable, {
	name: "Hookable",
	namespace: "hookable",
	extends: DeferredPromise,
	proto: ["hook", "hookNS", "hookAll", "unhook", "unhookNS", "callHooks", "callHooksWith", "dispatchHooks", "clearHooks", "clearHooksNS", "forEachHookPartition", "getHookPartition"],
	static: ["create", "promised"],
	optionsTemplates: composeOptionsTemplates({
		noOwnerArg: true
	})
});

export {
	Hookable as PromisedHookable
};
