/* global FederatedCredential, PasswordCredential */

import {
	sym,
	then,
	clone,
	casing,
	hasOwn,
	assign,
	isObject,
	matchType,
	isPrimitive,
	isTypedArray,
	getConstructorName
} from "@qtxr/utils";
import URL from "@qtxr/url";
import { Hookable } from "@qtxr/bc";

const FINALIZEABLE = {
	ready: true,
	info: true,
	success: true,
	redirect: true,
	fail: true,
	aborted: true
};

const METHODS = {
	GET: "GET",
	HEAD: "HEAD",
	POST: "POST",
	PUT: "PUT",
	DELETE: "DELETE",
	CONNECT: "CONNECT",
	OPTIONS: "OPTIONS",
	TRACE: "TRACE",
	PATCH: "PATCH"
};

const PHASES = {
	STARTED: "STARTED",
	INITIALIZED: "INITIALIZED",
	INFOD: "INFOD",
	REDIRECTED: "REDIRECTED",
	SUCCEEDED: "SUCCEEDED",
	FAILED: "FAILED",
	TIMEDOUT: "TIMEDOUT",
	ABORTED: "ABORTED"
};

class NullImpl {}

const IMPLS = {
	NULL: NullImpl,
	BLOB: typeof Blob != "undefined" ?
		Blob :
		NullImpl,
	FORM_DATA: typeof FormData != "undefined" ?
		FormData :
		NullImpl,
	URL_SEARCH_PARAMS: typeof URLSearchParams != "undefined" ?
		URLSearchParams :
		NullImpl,
	DATA_VIEW: typeof DataView != "undefined" ?
		DataView :
		NullImpl,
	ARRAY_BUFFER: typeof ArrayBuffer != "undefined" ?
		ArrayBuffer :
		NullImpl,
	HEADERS: typeof Headers != "undefined" ?
		Headers :
		NullImpl,
	XML_DOCUMENT: typeof XMLDocument != "undefined" ?
		XMLDocument :
		NullImpl,
	FEDERATED_CREDENTIAL: typeof FederatedCredential != "undefined" ?
		FederatedCredential :
		NullImpl,
	PASSWORD_CREDENTIAL: typeof PasswordCredential != "undefined" ?
		PasswordCredential :
		NullImpl
};

const PRESET_ALIASES = {
	body: "payload"
};

const PRESET_TRANSFORMS = {
	headers: value => {
		if (value instanceof IMPLS.HEADERS) {
			const headers = {};

			value.forEach((v, k) => {
				headers[casing(k).to.kebab] = v;
			});

			return headers;
		}
		
		if (isObject(value)) {
			const headers = {};

			for (const k in value) {
				if (!hasOwn(value, k))
					continue;

				headers[casing(k).to.kebab] = value[k];
			}

			return headers;
		}

		return value;
	}
};

const SOURCE_TARGET_REGEX = /^(?:([\w-:]*)\s*->\s*)?([\w-:]+)$/,
	NAMESPACE_REGEX = /^(?:(s(?:tatic)?|o(?:nce)?):)?(\w+)$/,
	DEFAULT_HOOK_NAMESPACE = "once",
	DEFAULT_HOOK_NAMESPACES = {
		init: "once",
		progress: "static",
		uploadProgress: "static",
		downloadProgress: "static",
		statechange: "once",
		ready: "once",
		info: "once",
		success: "once",
		redirect: "once",
		fail: "once",
		aborted: "once",
		lastly: "once"
	},
	NAMESPACE_OPTIONS = {
		once: {
			ttl: 1
		},
		static: {
			ttl: Infinity
		}
	},
	NAMESPACE_ALIASES = {
		n: "once",
		s: "static",
		once: "once",
		static: "static"
	},
	REQUEST_MANAGER_SPECIES_SYM = sym("RequestManager species");

let globalId = 0;

class RequestManager {
	constructor(options, initOptions = {}) {
		options = isObject(options) ? options : null;

		const {
			options: defOptions = {},
			presetSchema = {},
			presetAliases = {},
			presetTransforms = {},
			stateConstructor = RequestState,
			responseConstructor = RequestResponse
		} = initOptions;

		this.runtime = {};
		this.presets = {};
		this.macroKeys = {};
		this.currentGuard = null;
		this.pendingPreset = null;

		this.opts = assign(
			{},
			defOptions,
			options
		);
		this.presetSchema = assign(
			{},
			presetSchema,
			this.opts.presetSchema
		);
		this.presetAliases = assign(
			{},
			PRESET_ALIASES,
			presetAliases,
			this.opts.presetAliases
		);
		this.presetTransforms = assign(
			{},
			PRESET_TRANSFORMS,
			presetTransforms,
			this.opts.presetTransforms
		);

		this.stateConstructor = stateConstructor;
		this.responseConstructor = responseConstructor;

		if (this.opts.inherits instanceof RequestManager) {
			const testator = this.opts.inherits;
			this.presets = clone(testator.presets);

			for (const k in testator.macroKeys) {
				if (!hasOwn(testator.macroKeys, k))
					continue;

				this[k] = testator[k];
				this.macroKeys[k] = true;
			}
		}
	}

	definePreset(name, preset) {
		const noDuplicates = this.opts.noDuplicatePresets;

		if (!name || typeof name != "string") {
			console.warn(`Cannot define preset: name is not valid`);
			return this;
		}

		if (noDuplicates && hasOwn(this.presets, name)) {
			console.warn(`Cannot define preset: preset by name '${name}' is already in use`);
			return this;
		}

		this.presets[name] = preset;
		return this;
	}

	deletePreset(name) {
		delete this.presets[name];
		return this;
	}

	defineMacro(key, handler) {
		if (!key || typeof key != "string") {
			console.warn(`Cannot define macro: key is invalid`);
			return this;
		}

		if (typeof handler != "function") {
			console.warn(`Cannot define macro: handler is not a function`);
			return this;
		}

		if (hasOwn(this, key)) {
			console.warn(`Cannot define macro: this request manager already has a property with key '${key}'`);
			return this;
		}

		if (key in this) {
			console.warn(`Cannot define macro: won't shadow property with key '${key}'`);
			return this;
		}

		this.macroKeys[key] = true;
		this[key] = handler;
		return this;
	}

	deleteMacro(key) {
		if (!hasOwn(this.macroKeys, key)) {
			console.warn(`Cannot delete macro: no macro by name '${key}' defined`);
			return this;
		}

		delete this[key];
		delete this.macroKeys[key];

		return this;
	}

	use(...presets) {
		let outPreset = this.pendingPreset || getPresetStruct(),
			added = false;

		const inject = presetsArr => {
			for (let i = 0, l = presetsArr.length; i < l; i++) {
				const pi = presetsArr[i];

				if (Array.isArray(pi)) {
					inject(pi);
					continue;
				}

				const preset = typeof pi == "string" ?
					this.presets[pi] :
					pi;

				if (!isObject(preset))
					continue;

				added = true;
				outPreset = this.injectPreset(outPreset, preset);
			}
		};

		inject(presets);

		if (added)
			this.pendingPreset = outPreset;

		return this;
	}

	injectPreset(pending, preset, transform = null) {
		if (!preset)
			return pending;

		for (const k in preset) {
			if (!hasOwn(preset, k))
				continue;

			let key = k,
				value = preset[k];

			if (hasOwn(this.presetAliases, key))
				key = this.presetAliases[key];

			value = resolvePresetProp(this, key, value, [
				this,
				pending
			]);

			if (hasOwn(this.presetTransforms, key))
				value = this.presetTransforms[key](value, key, preset);
			if (typeof transform == "function")
				value = transform(value, key, preset);

			pending[key] = mergeData(pending[key], value);
		}

		return pending;
	}

	attachRuntime(runtimeData) {
		assign(this.runtime, runtimeData);
	}

	guard(callback) {
		this.currentGuard = callback;
		return this;
	}

	testGuard(runtime) {
		const guard = this.currentGuard;
		this.currentGuard = null;
	
		if (typeof guard == "function")
			return Boolean(guard(this, runtime));
	
		return true;
	}

	// Without data payload
	get(url) {
		return this.request("GET", url);
	}

	head(url) {
		return this.request("HEAD", url);
	}

	delete(url) {
		return this.request("DELETE", url);
	}

	connect(url) {
		return this.request("CONNECT", url);
	}

	options(url) {
		return this.request("OPTIONS", url);
	}

	trace(url) {
		return this.request("TRACE", url);
	}

	// With data payload
	post(url, data) {
		return this.request("POST", url, data);
	}

	put(url, data) {
		return this.request("PUT", url, data);
	}

	patch(url, data) {
		return this.request("PATCH", url, data);
	}

	request(method, url, data) {
		if (!method || typeof method != "string")
			throw new Error("Cannot make request: invalid method");

		method = method.toUpperCase();

		if (!hasOwn(METHODS, method))
			throw new Error(`Cannot make request: no supported method by type '${method}'`);

		const preset = this.pendingPreset || {};
		let runtime = {
			method,
			preset,
			id: globalId++,
			url: mkUrl(url, preset),
			payload: data,
			phase: PHASES.STARTED,
			state: null,
			response: null,
			finished: false,
			usesUpload: false,
			upload: mkProgress("upload", 0, 0),
			download: mkProgress("download", 0, 0),
			callHooks: (type, ...args) => {
				runtime.state.callHooks(type, false, ...args);
			},
			isRuntime: true
		};

		if (!this.testGuard(runtime))
			return this.stateConstructor.NULL || RequestState.NULL;

		this.pendingPreset = null;

		const state = resolveState(this, runtime);
		runtime.state = state;

		then(this.initRequest(runtime), rt => {
			assign(runtime, rt);
			runtime.response = new this.responseConstructor(this, runtime);

			state.link(this, runtime);
			state.applyInit(runtime);
			runtime.phase = PHASES.INITIALIZED;

			this.sendRequest(runtime);
		});

		return state;
	}

	async initRequest() {
		return null;
	}

	sendRequest(runtime) {
		switch (runtime.method) {
			case METHODS.GET:
			case METHODS.HEAD:
			case METHODS.DELETE:
			case METHODS.CONNECT:
			case METHODS.OPTIONS:
			case METHODS.TRACE:
				this.sendOneWayRequest(runtime);
				break;

			case METHODS.POST:
			case METHODS.PUT:
			case METHODS.PATCH:
				this.sendTwoWayRequest(runtime);
				break;
		}
	}

	// For methods that generally request a resource in a unidirectional way,
	// usally without sending a request body
	sendOneWayRequest() {
		throw new Error("Failed to send one way request: no handler implemented");
	}

	// For methods that generally request a resource in a bidirectional way,
	// usually by sending a request body and retrieving a result
	sendTwoWayRequest() {
		throw new Error("Failed to send two way request: no handler implemented");
	}

	getSpecies() {
		return {
			type: this.constructor[REQUEST_MANAGER_SPECIES_SYM],
			feature: "manager"
		};
	}

	static isJSONOptimizable(val) {
		if (Array.isArray(val))
			return true;

		if (typeof val == "object") {
			for (const k in val) {
				if (val[k] && typeof val[k] == "object")
					return true;
			}
		}

		return false;
	}

	static getSpecies(inst) {
		if (!inst || typeof inst.getSpecies != "function") {
			return {
				type: null,
				feature: null
			};
		}

		return inst.getSpecies();
	}
}

class RequestState extends Hookable {
	constructor(manager, runtime = {}) {
		super({
			hookable: "noOwnerArg"
		});

		this.manager = manager;
		this.id = runtime.id;
		this.runtime = runtime;
		this.preset = runtime.preset || {};
		this.finished = false;
		this.response = null;

		this._progress = {
			loaded: 0,
			total: 0,
			perc: 0
		};
	}

	link(manager, runtime) {
		this.manager = manager;
		this.id = runtime.id;
		this.runtime = runtime;
		this.preset = runtime.preset || {};
		this.finished = false;
		this.response = runtime.response;

		this.setProgress(0, 0);

		flushHooks(this, manager.opts.flush);
		injectStateDependencies(this, runtime);
	}

	// Request lifecycle 
	applyInit() {
		throw new Error("Failed to init: no handler implemented");
	}

	applyPayload(payload) {
		this.runtime.usesUpload = true;
		this.runtime.upload = mkProgress(
			"upload",
			0,
			getPayloadSize(payload)
		);
	}

	applyProgress(mode, loaded, total) {
		const progress = this.setProgress(mode, loaded, total);
		this.runtime[mode] = progress;
		this.callHooks("progress", true, progress);
		this.callHooks(`${mode}Progress`, true, progress);
	}

	setProgress(mode, loaded, total) {
		const progress = mkProgress(mode, loaded, total);
		this._progress = progress;
		return progress;
	}

	getProgress() {
		return assign({}, this._progress);
	}
	
	applyResponse(response, ...args) {
		let hookType = null;

		this.callHooks("ready", true, response, ...args);

		switch (Math.floor(response.status / 100)) {
			case 1:
				this.runtime.phase = PHASES.INFOD;
				hookType = "info";
				break;

			case 2:
				this.runtime.phase = PHASES.SUCCEEDED;
				hookType = "success";
				break;

			case 3:
				this.runtime.phase = PHASES.REDIRECTED;
				hookType = "redirect";
				break;

			case 4:
			case 5:
				this.runtime.phase = PHASES.FAILED;
				hookType = "fail";
				break;
		}

		if (hookType) {
			if (this.preset.enforceReponseReturn || hookType == "success")
				this.dispatchHooks(hookType, mkResponseResolver(response, args));
			else
				this.callHooks(hookType, true, response.status, ...args);
		}
	}
	
	applyFail(response, ...args) {
		this.runtime.phase = PHASES.FAILED;

		if (this.preset.enforceReponseReturn)
			this.dispatchHooks("fail", mkResponseResolver(response, args));
		else
			this.callHooks("fail", true, response.status, ...args);
	}
	
	applyTimeout(response, ...args) {
		this.runtime.phase = PHASES.TIMEDOUT;

		if (this.preset.enforceReponseReturn)
			this.dispatchHooks("timeout", mkResponseResolver(response, args));
		else
			this.callHooks("timeout", true, response.status, ...args);
	}
	
	applyAbort(response, ...args) {
		this.runtime.phase = PHASES.ABORTED;

		if (this.preset.enforceReponseReturn)
			this.dispatchHooks("aborted", mkResponseResolver(response, args));
		else
			this.callHooks("aborted", true, response.status, ...args);
	}

	abort() {
		throw new Error("Cannot abort: no abort handler implemented");
	}

	async applyFinish(response) {
		const dispatchType = response.success ?
			"resolve" :
			(this.preset.rejectOnError ? "reject" : "resolve");

		this.finished = true;
		this.runtime.finished = true;

		if (!this.preset.lazyDecode)
			await this.response.response;
		
		this.dispatchPromise(dispatchType, response);
	}

	// Hooks
	init(hook) {
		return this.hook("init", hook);
	}

	progress(hook) {
		return this.hook("progress", hook);
	}

	uploadProgress(hook) {
		return this.hook("uploadProgress", hook);
	}

	downloadProgress(hook) {
		return this.hook("downloadProgress", hook);
	}

	statechange(hook) {
		return this.hook("statechange", hook);
	}

	ready(hook) {
		return this.hook("ready", hook);
	}

	// HTTP 1xx
	info(hook) {
		return this.hook("info", hook);
	}

	// HTTP 2xx
	success(hook) {
		return this.hook("success", hook);
	}

	// HTTP 3xx
	redirect(hook) {
		return this.hook("redirect", hook);
	}

	// HTTP 4xx - 5xx
	fail(hook) {
		return this.hook("fail", hook);
	}

	// HTTP timeout
	timeout(hook) {
		return this.hook("timeout", hook);
	}

	// HTTP Abort
	aborted(hook) {
		return this.hook("aborted", hook);
	}

	// Finally (renamed as not to shadow promise method)
	lastly(hook) {
		return this.hook("lastly", hook);
	}

	hook(...args) {
		const a = this.resolveHookArgs("hook", args);

		if (typeof a.partitionName != "string") {
			console.warn(`Failed to add hook: ${a.partitionName} is not a valid type`);
			return this;
		}

		let source = null,
			target = null;

		const ex = SOURCE_TARGET_REGEX.exec(a.partitionName);

		if (!ex)
			return this;

		if (!ex[1])
			source = ex[2];
		else {
			source = ex[1];
			target = ex[2];
		}

		source = resolveType(source);
		target = resolveType(target);

		if (target.name) {
			return this.mountHook(source, args, (handler, args) => {
				if (typeof handler == "function")
					handler(...args);

				this.callHooks(target, false, ...args);
			});
		}

		if (source.name) {
			return this.mountHook(source, args, (handler, args) => {
				if (typeof handler == "function")
					handler(...args);
			});
		}

		return this;
	}

	mountHook(type, hookArgs, dispatcher) {
		const opts = this.resolveHookArgs("hook", hookArgs, {
				defaults: resolveDefaultHookOptions(type)
			}),
			refId = this.id;

		opts.partitionName = type.name;

		super.hook({
			...opts,
			handler: (tpe, nativeCall, ...args) => {
				if (this.manager.opts.withRuntime)
					dispatcher(opts.handler, [this.mkRuntime(), ...args, this]);
				else
					dispatcher(opts.handler, [...args, this]);

				if (type.name != "any")
					this.callHooks("any", false, ...args, this);

				if (nativeCall && !this.finished && hasOwn(FINALIZEABLE, type.name))
					this.callHooks("lastly", false, ...args, this);
			},
			guard: tpe => {
				if (refId != null && this.id != refId)
					return false;

				if (tpe.namespace && opts.namespace != tpe.namespace)
					return false;

				return true;
			}
		});

		return this;
	}

	callHooks(type, nativeCall, ...args) {
		type = resolveType(type);
		return super.callHooks(type.name, type, nativeCall, ...args);
	}

	dispatchHooks(type, resolver) {
		type = resolveType(type);

		return super.dispatchHooks(type.name, async (...args) => {
			const resolved = await resolver(...args);
			return [type, ...resolved];
		});
	}

	mkRuntime() {
		return assign(
			{},
			this.runtime,
			this.manager.runtime
		);
	}

	getSpecies() {
		return {
			type: this.manager.constructor[REQUEST_MANAGER_SPECIES_SYM],
			feature: "state"
		};
	}

	// Strip runtime data to normalize hooks presets, etc
	static withoutRuntime(callback) {
		return (rtCandidate, ...args) => {
			if (rtCandidate && rtCandidate.isRuntime)
				callback(...args);
			else
				callback(rtCandidate, ...args);
		};
	}

	// Postulate function: requires hook arguments to use a runtime
	static requireRuntime(callback) {
		return (rtCandidate, ...args) => {
			if (!rtCandidate || !rtCandidate.isRuntime)
				console.error("Cannot call hook because it requires a runtime");
			else
				callback(rtCandidate, ...args);
		};
	}
}

class RequestResponse {
	constructor(manager, runtime) {
		this.manager = manager;
		this.state = runtime.state;
		this.runtime = runtime;
		this.preset = runtime.preset;
		this.cachedResponse = null;
	}

	clone() {
		const inst = new this.constructor(this.manager, this.runtime);
		inst.cachedResponse = this.cachedResponse;
		return inst;
	}

	async decode() {
		return warnNoMethod("decode");
	}

	async arrayBuffer() {
		return warnNoMethod("arrayBuffer");
	}

	async blob() {
		return warnNoMethod("blob");
	}

	async formData() {
		return warnNoMethod("formData");
	}

	async json() {
		return warnNoMethod("json");
	}

	async text() {
		return warnNoMethod("text");
	}

	get response() {
		if (this.cachedResponse)
			return this.cachedResponse;
		
		const response = this.decode(false);

		response.then(res => {
			this.cachedResponse = res;
			return res;
		});

		this.cachedResponse = response;
		return response;
	}

	get body() {
		return this.decode(false);
	}

	get bodyUsed() {
		return warnNoGetter("bodyUsed");
	}

	get headers() {
		return warnNoGetter("headers");
	}

	get status() {
		return warnNoGetter("status");
	}

	get statusText() {
		return warnNoGetter("statusText");
	}

	get type() {
		return warnNoGetter("type");
	}

	get url() {
		return warnNoGetter("url");
	}

	get ok() {
		return ~~(this.status / 100) == 2;
	}

	get success() {
		return ~~(this.status / 100) == 2;
	}

	get redirected() {
		return this.url != this.runtime.url;
	}

	get timedout() {
		return this.runtime.phase == PHASES.TIMEDOUT;
	}

	get aborted() {
		return this.runtime.phase == PHASES.ABORTED;
	}

	get finished() {
		return this.runtime.finished;
	}

	get phase() {
		return this.runtime.phase;
	}

	getSpecies() {
		return {
			type: this.manager.constructor[REQUEST_MANAGER_SPECIES_SYM],
			feature: "response"
		};
	}
}

// General runtime utils
function resolveType(type) {
	if (isObject(type))
		return type;

	if (typeof type != "string") {
		return {
			namespace: null,
			name: null
		};
	}

	const ex = NAMESPACE_REGEX.exec(type);

	if (!ex || !hasOwn(NAMESPACE_ALIASES, ex[1])) {
		return {
			namespace: null,
			name: type
		};
	}

	return {
		namespace: NAMESPACE_ALIASES[ex[1]],
		name: ex[2]
	};
}

function resolveDefaultHookOptions(type) {
	let namespace = type.namespace;

	const emit = ns => {
		const opts = assign({}, NAMESPACE_OPTIONS[ns]);
		opts.namespace = ns;
		return opts;
	};

	if (!namespace && hasOwn(DEFAULT_HOOK_NAMESPACES, type.name))
		namespace = DEFAULT_HOOK_NAMESPACES[type.name];

	if (hasOwn(NAMESPACE_OPTIONS, namespace))
		return emit(namespace);

	return emit(DEFAULT_HOOK_NAMESPACE);
}

function resolveState(manager, runtime) {
	if (manager.opts.state)
		return manager.opts.state;
	else {
		const constr = manager.opts.stateConstructor || manager.stateConstructor;
		return new constr(manager, runtime, ...manager.opts.stateArgs);
	}
}

function resolvePresetProp(manager, key, value, args) {
	if (!manager.presetSchema || !hasOwn(manager.presetSchema, key) || value == null)
		return value;

	if (typeof value == "function" && !matchType(value, manager.presetSchema[key]))
		return value(...args);

	return value;
}

function injectStateDependencies(state, requestRuntime) {
	const hooks = requestRuntime.preset && requestRuntime.preset.hooks;

	if (!hooks)
		return;

	for (const k in hooks) {
		// FIXME: when bc/Hookable is updated to not store metadata in a singular object, remove last two checks
		if (!hasOwn(hooks, k) || k == "last" || k == "keys")
			continue;

		state.hook(k, hooks[k]);
	}
}

function flushHooks(hookable, flush) {
	if (Array.isArray(flush)) {
		for (let i = 0, l = flush.length; i < l; i++)
			hookable.clearHooksNS(flush[i]);
	}
}

function mkProgress(mode, loaded, total) {
	mode = mode || "download";
	loaded = loaded || 0;
	total = total || loaded;

	const progress = {
		mode,
		loaded,
		total,
		perc: 0
	};

	const perc = loaded / total;

	if (typeof perc == "number")
		progress.perc = perc || 0;

	return progress;
}

// Data management utils
function getPresetStruct() {
	return {
		baseUrl: null,
		headers: {},
		urlParams: {},
		payload: null,
		hooks: {}
	};
}

function mergeData(acc, data) {
	if (!acc)
		return clone(data);

	if (!data)
		return acc;

	const dType = getDataType(data),
		aType = getDataType(acc);

	if (dType == "array" && aType == "array")
		return acc.concat(data);
	if (dType == "object" && aType == "object")
		return assign(acc, clone(data));
	if (dType == "other" && aType == "other")
		return data;

	throw new TypeError(`Type mismatch: can't merge ${getConstructorName(data)} with ${getConstructorName(acc)}`);
}

function getDataType(data) {
	if (Array.isArray(data))
		return "array";

	if (isObject(data))
		return "object";

	return "other";
}

// Request setup utils
function mkUrl(url, preset) {
	if (typeof url != "string")
		url = typeof preset.url == "string" ? preset.url : "";

	url = new URL(url);

	const urlParams = mkUrlParams(preset.urlParams);

	if (!url.relative)
		return url.join(urlParams);

	if ((preset.baseUrl || preset.baseUrl == ""))
		return URL.join(preset.baseUrl, url, urlParams);

	return URL.join(window.location.href, url, urlParams);
}

function mkUrlParams(params) {
	if (!isObject(params))
		return "";

	const paramsOut = [];

	for (const k in params) {
		if (!hasOwn(params, k) || !isPrimitive(params[k]))
			continue;

		paramsOut.push(`${k}=${params[k]}`);
	}

	return `?${paramsOut.join("&")}`;
}

// Request utils
function getPayloadType(payload) {
	if (typeof payload == "string")
		return "string";

	if (payload instanceof IMPLS.BLOB)
		return "blob";

	if (payload instanceof IMPLS.FORM_DATA)
		return "formdata";

	if (payload instanceof IMPLS.URL_SEARCH_PARAMS)
		return "url-search-params";

	if (isTypedArray(payload))
		return "buffer-source";

	if (payload instanceof IMPLS.DATA_VIEW)
		return "buffer-source";

	if (payload instanceof IMPLS.ARRAY_BUFFER)
		return "buffer-source";

	return null;
}

function getPayloadSize(payload) {
	switch (getPayloadType(payload)) {
		case "string":
			return payload.length;

		case "blob":
			return payload.size;

		case "formdata":
			return 0;

		case "url-search-params":
			return payload.toString().length;

		case "buffer-source":
			return payload.byteLength;

		default:
			return 0;
	}
}

function normalizeContentType(contentType) {
	if (!contentType)
		return null;

	if (contentType.indexOf("text/plain") > -1)
		return "plain";

	if (contentType.indexOf("application/json") > -1)
		return "json";

	if (contentType.indexOf("x-www-form-urlencoded") > -1)
		return "urlencoded";

	if (contentType.indexOf("multipart/form-data") > -1)
		return "formdata";

	return null;
}

function getEncodeContentType(preset) {
	const headers = preset.headers || {};

	let contentType;

	if (headers instanceof IMPLS.HEADERS)
		contentType = headers.get("content-type");
	else
		contentType = headers["content-type"] || headers["Content-Type"];

	return normalizeContentType(contentType);
}

function encodePayload(payload, preset) {
	if (getPayloadType(payload))
		return payload;

	switch (getEncodeContentType(preset)) {
		case "urlencoded": {
			const dataArr = [];

			if (typeof payload != "object")
				return String(payload);

			for (const key in payload) {
				if (!hasOwn(payload, key))
					continue;

				let d = payload[key];

				if (Array.isArray(d)) {
					for (let i = 0; i < d.length; i++)
						dataArr.push(key + "%5B%5D=" + encodeURIComponent(d[i]));
				} else {
					if (typeof d == "object")
						d = JSON.stringify(d);

					dataArr.push(key + "=" + encodeURIComponent(d));
				}
			}

			return dataArr.join("&");
		}

		case "json":
		default:
			if (typeof payload == "object")
				return JSON.stringify(payload);

			// Else stringify to plain payload
			return String(payload);
	}
}

// Response utils
function mkResponseResolver(response, args) {
	return async _ => {
		const res = await response.response;
		return [true, res, ...args];
	};
}

function warnNoMethod(name) {
	console.warn(`This response doesn't implement a method by name '${name}'`);
	return null;
}

function warnNoGetter(name) {
	console.warn(`This response doesn't implement a getter by name '${name}'`);
	return null;
}

RequestState.NULL = new RequestState();
RequestManager[REQUEST_MANAGER_SPECIES_SYM] = "core";

export {
	FINALIZEABLE,
	METHODS,
	PHASES,
	IMPLS,
	PRESET_ALIASES,
	PRESET_TRANSFORMS,
	SOURCE_TARGET_REGEX,
	NAMESPACE_REGEX,
	DEFAULT_HOOK_NAMESPACE,
	DEFAULT_HOOK_NAMESPACES,
	NAMESPACE_OPTIONS,
	NAMESPACE_ALIASES,
	REQUEST_MANAGER_SPECIES_SYM,
	// Classes
	RequestManager,
	RequestState,
	RequestResponse,
	// General runtime utils
	resolveType,
	resolveState,
	resolvePresetProp,
	injectStateDependencies,
	flushHooks,
	mkProgress,
	// Data management utils
	getPresetStruct,
	mergeData,
	// Request setup utils
	mkUrl,
	mkUrlParams,
	// Request utils
	getPayloadType,
	getPayloadSize,
	normalizeContentType,
	encodePayload,
	// Response utils
	mkResponseResolver
};
