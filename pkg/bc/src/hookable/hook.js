export default class Hook {
	constructor(owner, data, opt) {
		this.owner = owner;
		this.data = data;
		this.opt = opt;

		this.originalHandler = null;
		this.originalGuard = null;
		this.handler = this.data.handler;
		this.guard = this.data.guard;
	}

	set handler(func) {
		if (typeof func != "function")
			return;

		this.data.handler = bindFunc(func, this);
		this.data.originalHandler = func;
		this.originalHandler = func;
	}

	get handler() {
		return this.data.originalHandler;
	}

	set guard(func) {
		if (typeof func != "function")
			return;

		this.data.guard = bindFunc(func, this);
		this.data.originalGuard = func;
		this.originalGuard = func;
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

	handle(args, contextArgs) {
		return applyFunc(this.data.handler, this, args, contextArgs);
	}

	proceed(args, contextArgs) {
		if (typeof this.data.guard != "function")
			return true;

		return applyFunc(this.data.guard, this, args, contextArgs);
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

	mkContext(contextArgs) {
		return Object.assign({
			hook: this,
			owner: this.owner
		}, contextArgs);
	}
}

function bindFunc(func, hook) {
	switch (hook.data.argTemplate) {
		case "context":
		case "noOwnerArg":
			return func.bind(hook.owner);
	}

	if (hook.opt("noOwnerArg"))
		return func.bind(hook.owner);

	return func.bind(hook.owner, hook.owner);
}

function applyFunc(func, hook, args, contextArgs) {
	// context and first argument is already bound
	switch (hook.data.argTemplate) {
		case "context":
			return func(hook.mkContext(contextArgs), ...args);
		default:
			return func.apply(null, args);
	}
}
