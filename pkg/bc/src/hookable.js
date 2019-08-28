import {
	filterMut,
	resolveArgs,
	isObject
} from "@qtxr/utils";

// TODO: in first major version, rename nickname to identifier

const reservedFields = {
	last: true
};

const hookParams = [
	{ name: "partitionName", type: "string", required: true },
	{ name: "handler", type: "function", required: true },
	{ name: "nickname", type: "string", default: null },
	{ name: "namespace", type: ["string", "symbol"], default: null },
	{ name: "ttl", type: "number", default: Infinity },
	{ name: "guard", type: "function", default: null }
];

const hookNSParams = [
	{ name: "namespace", type: ["string", "symbol"], required: true },
	{ name: "partitionName", type: "string", required: true },
	{ name: "handler", type: "function", required: true },
	{ name: "nickname", type: ["string", "symbol"], default: null },
	{ name: "ttl", type: "number", default: Infinity },
	{ name: "guard", type: "function", default: null }
];

export default class Hookable {
	constructor() {
		Object.defineProperty(this, "hooks", {
			value: {
				last: null
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
	}

	unhook(nameOrHook, handler, nickname) {
		const partitionName = nameOrHook instanceof Hook ? nameOrHook.partitionName : nameOrHook;

		if (typeof handler == "string") {
			nickname = handler;
			handler = null;
		}

		const hooks = this.hooks[partitionName];

		if (!Array.isArray(hooks) || reservedFields.hasOwnProperty(partitionName))
			return this;

		filterMut(hooks, hook => !hook.is(nameOrHook, handler, nickname));

		if (!hooks.length)
			delete this.hooks[partitionName];

		return this;
	}

	callHooks(partitionName, ...args) {
		const hooks = this.hooks[partitionName];

		if (!Array.isArray(hooks) || reservedFields.hasOwnProperty(partitionName))
			return this;

		filterMut(hooks, hook => {
			if (hook.spent)
				return false;

			if (hook.proceed(args)) {
				hook.handle(args);
				return hook.decTTL() > 0;
			} else
				return true;
		});

		if (!hooks.length)
			delete this.hooks[partitionName];

		return this;
	}

	clearHooks() {
		for (const k in this.hooks) {
			if (this.hooks.hasOwnProperty(k) && !reservedFields.hasOwnProperty(k))
				delete this.hooks[k];
		}

		return this;
	}

	clearHooksNS(ns) {
		for (const k in this.hooks) {
			if (!this.hooks.hasOwnProperty(k) || reservedFields.hasOwnProperty(k))
				continue;

			const hooks = this.hooks[k];
			filterMut(hooks, h => h.namespace != ns);

			if (!hooks.length)
				delete this.hooks[k];
		}

		return this;
	}
}

function addHook(inst, paramMap, args) {
	const data = resolveArgs(args, paramMap, "allowSingleSource"),
		partitionName = data.partitionName;

	if (reservedFields.hasOwnProperty(partitionName))
		return console.warn(`Cannot set hooks at '${partitionName}' because it's a reserved field`);

	const hooks = inst.hooks.hasOwnProperty(partitionName) ? inst.hooks[partitionName] : [];
	inst.hooks[partitionName] = hooks;

	const hook = new Hook(inst, data);
	inst.hooks.last = hook;
	hooks.push(hook);
	return hook;
}

class Hook {
	constructor(owner, data) {
		this.owner = owner;
		this.data = data;

		this.handler = this.data.handler;
		this.guard = this.data.guard;
	}

	set handler(func) {
		if (typeof func != "function")
			return;

		this.data.handler = func.bind(this.owner, this.owner);
		this.data.originalHandler = func;
	}

	get handler() {
		return this.data.originalHandler;
	}

	set guard(func) {
		if (typeof func != "function")
			return;

		this.data.guard = func.bind(this.owner, this.owner);
		this.data.originalGuard = func;
	}

	get guard() {
		return this.data.originalGuard;
	}

	get partitionName() {
		return this.data.partitionName;
	}

	get nickname() {
		return this.data.nickname;
	}

	get namespace() {
		return this.data.namespace;
	}

	get ttl() {
		return this.data.ttl;
	}

	get spent() {
		return this.data.ttl == 0;
	}

	handle(args) {
		// this and first argument is bound as hook.owner 
		return this.data.handler.apply(null, args);
	}

	proceed(args) {
		if (typeof this.data.guard != "function")
			return true;

		// this and first argument is bound as hook.owner 
		return Boolean(this.data.guard.apply(null, args));
	}

	unhook() {
		this.owner.unhook(this);
	}

	decTTL() {
		this.data.ttl = Math.max(this.data.ttl - 1, 0);
		return this.data.ttl;
	}

	is(nameOrHook, handler, nickname) {
		if (nameOrHook instanceof Hook)
			return nameOrHook == this;

		if (typeof handler == "function" && typeof nickname == "string")
			return handler == this.data.originalHandler && (Boolean(nickname) && nickname == this.data.nickname);
		else
			return handler == this.data.originalHandler || (Boolean(nickname) && nickname == this.data.nickname);
	}
}
