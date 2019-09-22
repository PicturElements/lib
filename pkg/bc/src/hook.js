export default class Hook {
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
