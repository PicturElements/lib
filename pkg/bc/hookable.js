import {
	filterMut,
	resolveArgs,
	isObject
} from "@qtxr/utils";

const reservedFields = {
	last: true
};

const hookParams = [
	{ name: "name", type: "string", required: true },
	{ name: "handler", type: "function", required: true },
	{ name: "nickname", type: "string", default: null },
	{ name: "namespace", type: ["string", "symbol"], default: null },
	{ name: "ttl", type: "number", default: Infinity },
];

const hookNSParams = [
	{ name: "namespace", type: ["string", "symbol"], required: true },
	{ name: "name", type: "string", required: true },
	{ name: "handler", type: "function", required: true },
	{ name: "nickname", type: "string", default: null },
	{ name: "ttl", type: "number", default: Infinity },
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
		const dispatch = (name, d) => {
			const handler = typeof d == "function" ? d : d.handler;
			this.hook(name, handler, d.nickname, d.namespace, d.ttl);
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
		const name = nameOrHook instanceof Hook ? nameOrHook.partitionName : nameOrHook;

		if (typeof handler == "string") {
			nickname = handler;
			handler = null;
		}

		const hooks = this.hooks[name],
			matchFully = typeof handler == "function" && typeof nickname == "string";

		if (!Array.isArray(hooks) || reservedFields.hasOwnProperty(name))
			return this;

		filterMut(hooks, hook => {
			if (hook == nameOrHook)
				return false;

			if (matchFully)
				return !(hook.handler == handler && (nickname && hook.nickname == nickname));
			else
				return !(hook.handler == handler || (nickname && hook.nickname == nickname));
		});

		if (!hooks.length)
			delete this.hooks[name];

		return this;
	}

	callHooks(name, ...args) {
		const hooks = this.hooks[name];

		if (!Array.isArray(hooks) || reservedFields.hasOwnProperty(name))
			return this;

		filterMut(hooks, hook => {
			if (hook.ttl <= 0)
				return false;

			hook.handler.call(this, this, ...args);
			return --hook.ttl > 0;
		});

		if (!hooks.length)
			delete this.hooks[name];

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

class Hook {
	constructor(owner, partitionName, handler, nickname, namespace, ttl) {
		this.owner = owner;
		this.partitionName = partitionName;
		this.handler = handler;
		this.nickname = nickname;
		this.namespace = namespace;
		this.ttl = ttl;
	}

	unhook() {
		this.owner.unhook(this);
	}
}

function addHook(inst, paramMap, args) {
	const {
		name,
		handler,
		nickname,
		namespace,
		ttl
	} = resolveArgs(args, paramMap, "hook");

	if (reservedFields.hasOwnProperty(name)) {
		console.warn(`Cannot set hooks at '${name}' because it's a reserved field`);
		return inst;
	}

	const hooks = inst.hooks.hasOwnProperty(name) ? inst.hooks[name] : [];
	inst.hooks[name] = hooks;

	const hook = new Hook(
		inst,
		name,
		handler,
		nickname,
		namespace,
		ttl
	);

	inst.hooks.last = hook;
	hooks.push(hook);
	return hook;
}
