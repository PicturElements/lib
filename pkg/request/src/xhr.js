import {
	clone,
	casing,
	isObject,
	isPrimitive,
	getConstructorName
} from "@qtxr/utils";
import URL from "@qtxr/url";
import { Hookable } from "@qtxr/bc";

const finalizeable = {
	success: true,
	fail: true
};

const sourceTargetRegex = /^(?:([\w-:]*)\s*->\s*)?([\w-:]+)$/,
	namespaceRegex = /^(?:(s(?:tatic)?|o(?:nce)?):)?(\w+)$/,
	defaultHookNS = "once",
	namespaceOptions = {
		once: {
			ttl: 1
		},
		static: {
			ttl: Infinity
		}
	},
	namespaceAliases = {
		n: "once",
		s: "static",
		once: "once",
		static: "static"
	};

class XHRManager {
	constructor(options) {
		options = isObject(options) ? options : null;

		this.pendingPreset = null;
		this.runtime = {};
		this.currentGuard = null;
		this.options = Object.assign({}, defaultXHROptions, options);
		this.presets = {};
		this.macroKeys = {};
	}

	definePreset(name, preset) {
		const noDuplicates = this.options.noDuplicatePresets;

		if (!name || typeof name != "string") {
			console.warn(`Cannot define preset: name is not valid`);
			return this;
		}

		if (noDuplicates && this.presets.hasOwnProperty(name)) {
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

		if (this.hasOwnProperty(key)) {
			console.warn(`Cannot define macro: this XHR manager already has a property with key '${key}'`);
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
		if (!this.macroKeys.hasOwnProperty(key)) {
			console.warn(`Cannot delete macro: no macro by name '${key}' defined`);
			return this;
		}

		delete this[key];
		delete this.macroKeys[key];

		return this;
	}

	use(...presets) {
		let outPreset = this.pendingPreset,
			added = false;

		const inject = presetsArr => {
			for (let i = 0, l = presetsArr.length; i < l; i++) {
				const pi = presetsArr[i];

				if (Array.isArray(pi)) {
					inject(pi);
					continue;
				}

				const preset = typeof pi == "string" ? this.presets[pi] : pi;

				if (!isObject(preset))
					continue;

				added = true;
				outPreset = injectPreset(outPreset, preset);
			}
		};

		inject(presets);

		if (added)
			this.pendingPreset = outPreset;
		return this;
	}

	guard(callback) {
		this.currentGuard = callback;
		return this;
	}

	get(url) {
		if (!testGuard(this))
			return XHRState.NULL;

		const xhr = new XMLHttpRequest(),
			xs = getState(this),
			xId = xs.link(this, xhr),
			preset = this.pendingPreset;

		injectStateDependencies(xs, this);

		xhr.onprogress = evt => handleProgress(evt, xId, xs);
		xhr.onreadystatechange = ({ target }) => handleStateChange(target, xId, xs, preset);
		xhr.onerror = ({ target }) => handleFail(xId, target, xs, preset);

		xhr.open("GET", mkUrl(url, preset));

		if (preset)
			setHeaders(xhr, preset);

		xhr.send();

		this.pendingPreset = null;
		xs.runInit();
		return xs;
	}

	post(url, data) {
		if (!testGuard(this))
			return XHRState.NULL;

		const xhr = new XMLHttpRequest(),
			xs = getState(this),
			xId = xs.link(this, xhr),
			preset = this.pendingPreset;

		injectStateDependencies(xs, this);

		xhr.onprogress = evt => handleProgress(evt, xId, xs);
		xhr.onreadystatechange = ({ target }) => handleStateChange(target, xId, xs, preset);
		xhr.onerror = ({ target }) => handleFail(xId, target, xs, preset);

		xhr.open("POST", mkUrl(url, preset));

		if (preset) {
			setHeaders(xhr, preset);
			data = mergeData(preset.payload, data);
		}
		
		xhr.send(encodeData(data, preset));

		this.pendingPreset = null;
		xs.runInit();
		return xs;
	}

	attachRuntime(runtimeData) {
		Object.assign(this.runtime, runtimeData);
	}

	static isJSONOptimizable(val) {
		if (Array.isArray(val))
			return true;

		if (typeof val == "object") {
			for (let key in val) {
				if (typeof val[key] == "object")
					return true;
			}
		}

		return false;
	}
}

function handleProgress(evt, xId, xs) {
	xs.setProgress(evt.loaded, evt.total);
	xs.callHooks("progress", xId, true, xs.getProgress());
}

function handleStateChange(xhr, xId, xs, preset) {
	if (xhr.readyState == 4) {
		if (xhr.status == 200) {
			const data = decodeData(xhr);
			xs.callHooks("success", xId, true, data, xhr);
		} else
			handleFail(xId, xhr, xs, preset);
	}
}

function handleFail(xId, xhr, xs, preset) {
	if (preset && preset.returnReponseOnFail)
		xs.callHooks("fail", xId, true, decodeData(xhr), xhr);
	else
		xs.callHooks("fail", xId, true, xhr.status, xhr);
}

let globalXId = 0;

class XHRState extends Hookable {
	constructor(xhr) {
		super();
		this.xhr = xhr;
		this.owner = null;
		this.finished = false;
		this.progress = {
			loaded: 0,
			total: 0,
			perc: 0
		};
		this.xId = null;
	}

	link(owner, xhr) {
		this.owner = owner;
		this.xhr = xhr;
		this.finished = false;
		this.xId = globalXId++;
		this.setProgress(0, 0);
		flushHooks(this, owner.options.flush, "load");

		return this.xId;
	}

	runInit() {
		this.callHooks("init", this.xId, true, this, this.xhr);
		this.callHooks("progress", this.xId, true, this.getProgress());
	}

	setProgress(loaded, total) {
		this.progress = {
			loaded: loaded || 0,
			total: total || 0,
			perc: 0
		};

		const progress = loaded / total;

		if (typeof progress == "number")
			this.progress.perc = progress || 0;
	}

	getProgress() {
		return this.progress;
	}

	init(hook) {
		return this.hook("init", hook);
	}

	progress(hook) {
		return this.hook("progress", hook);
	}

	success(hook) {
		return this.hook("success", hook);
	}

	fail(hook) {
		return this.hook("fail", hook);
	}

	finally(hook) {
		return this.hook("finally", hook);
	}

	hook(type, hook) {
		if (typeof type != "string") {
			console.warn(`Failed to add hook: ${type} is not a valid type`);
			return this;
		}
	
		let source = null,
			target = null;
	
		const ex = sourceTargetRegex.exec(type);

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
			return this.applyHook(source, hook, function(handler, xId, args) {
				if (typeof handler == "function")
					handler.apply(this, args);
				
				this.callHooks(target, xId, false, ...args);
			});
		}
	
		if (source.name) {
			return this.applyHook(source, hook, function(handler, xId, args) {
				if (typeof handler == "function")
					handler.apply(this, args);
			});
		}
	
		return this;
	}

	applyHook({ namespace, name }, handlerOrHook, dispatcher) {
		const hookDataPrecursor = typeof handlerOrHook == "function" ? {
			handler: handlerOrHook
		} : handlerOrHook;
	
		if (!isObject(hookDataPrecursor)) {
			console.warn(`Failed to add hook '${name}': hook is not an object or function`);
			return this;
		}

		const usedNamespace = namespace || defaultHookNS,
			hookData = Object.assign(
				{},
				namespaceOptions[usedNamespace],
				hookDataPrecursor
			),
			refXId = this.xId;
	
		super.hook({
			partitionName: name,
			handler(xs, type, xId, nativeCall, ...args) {
				if (this.owner.options.withRuntime)
					dispatcher.call(this, hookData.handler, xId, [mkRuntime(xs, xId), ...args, xs]);
				else
					dispatcher.call(this, hookData.handler, xId, [...args, xs]);
	
				if (name != "any") 
					xs.callHooks("any", xId, false, ...args);
					
				if (nativeCall && !xs.finished && finalizeable.hasOwnProperty(name)) {
					xs.finished = true;
					xs.callHooks("finally", xId, false, ...args);
					// TODO: maybe implement hook flushing here
				}
			},
			nickname: hookData.nickname,
			namespace: usedNamespace,
			ttl: hookData.ttl,
			guard(xs, type, xId, nativeCall, ...args) {
				if (xId != refXId && refXId !== null)
					return false;

				if (type.namespace && namespace != type.namespace)
					return false;

				return true;
			}
		});
	
		return this;
	}

	callHooks(type, xId, nativeCall, ...args) {
		type = resolveType(type);
		return super.callHooks(type.name, type, xId, nativeCall, ...args);
	}

	// Strip runtime data to normalize hooks presets, etc
	static withoutRuntime(callback) {
		return function(rtCandidate, ...args) {
			if (rtCandidate && rtCandidate.isRuntime)
				callback.call(this, ...args);
			else
				callback.call(this, rtCandidate, ...args);
		};
	}

	// Postulate function: requires hook arguments to use a runtime
	static requireRuntime(callback) {
		return function(rtCandidate, ...args) {
			if (!rtCandidate || !rtCandidate.isRuntime)
				console.error("Cannot call hook because it requires a runtime");
			else
				callback.call(this, rtCandidate, ...args);
		};
	}
}

function mkRuntime(state, xId) {
	return Object.assign(
		state.owner.runtime,
		{
			callHooks(type, ...args) {
				state.callHooks(type, xId, false, ...args);
			},
			state,
			isRuntime: true
		}
	);
}

function resolveType(type) {
	if (isObject(type))
		return type;

	if (typeof type != "string") {
		return {
			namespace: null,
			name: null
		};
	}

	const ex = namespaceRegex.exec(type);

	if (!ex || !namespaceAliases.hasOwnProperty(ex[1])) {
		return {
			namespace: null,
			name: type
		};
	}

	return {
		namespace: namespaceAliases[ex[1]],
		name: ex[2]
	};
}

function testGuard(manager) {
	const guard = manager.currentGuard;
	manager.currentGuard = null;

	if (typeof guard == "function")
		return Boolean(guard(manager));

	return true;
}

const presetStruct = {
	headers: {},
	payload: null,
	baseUrl: null,
	hooks: {}
};

function injectPreset(acc, data) {
	if (!acc)
		acc = clone(presetStruct);

	if (!data)
		return acc;

	for (const k in data) {
		if (!data.hasOwnProperty(k))
			continue;

		switch (k) {
			case "headers": {
				if (!isObject(data[k]))
					continue;

				const headers = {},
					inHeaders = data[k];

				for (const k2 in inHeaders) {
					if (!inHeaders.hasOwnProperty(k2))
						continue;

					headers[casing(k2).to("pascalKebab")] = inHeaders[k2];
				}

				acc[k] = mergeData(acc[k], headers);
				break;
			}
				
			default:
				acc[k] = mergeData(acc[k], data[k]);
		}
	}

	return acc;
}

function mergeData(acc, data) {
	if (!acc)
		return clone(data);

	if (!data)
		return acc;

	if (acc.constructor != data.constructor)
		throw new TypeError(`Type mismatch: can't merge ${getConstructorName(data)} with ${getConstructorName(acc)}`);

	if (typeof data != "object")
		return data;

	if (Array.isArray(data))
		return acc.concat(data);

	return Object.assign(acc, clone(data));
}

function mkUrl(url, preset) {
	if (typeof url != "string")
		url = (preset && typeof preset.url == "string") ? preset.url : "";

	const urlParams = mkUrlParams(preset && preset.urlParams);

	if (preset && preset.baseUrl)
		return URL.join(preset.baseUrl, url, urlParams);

	return URL.join(window.location.href, url, urlParams);
}

function mkUrlParams(params) {
	if (!isObject(params))
		return "";

	const paramsOut = [];

	for (const k in params) {
		if (!params.hasOwnProperty(k) || !isPrimitive(params[k]))
			continue;
		
		paramsOut.push(`${k}=${params[k]}`);
	}

	return `?${paramsOut.join("&")}`;
}

function setHeaders(xhr, preset) {
	const headers = preset.headers;

	for (const k in headers) {
		if (headers.hasOwnProperty(k))
			xhr.setRequestHeader(k, headers[k]);
	}
}

function encodeData(data, preset) {
	// If the data is a Blob, return it as-is,
	// as there's no reasonable way to encode it,
	// and XHR supports sending it
	if (typeof Blob != "undefined" && data instanceof Blob)
		return data;

	// Same for ArrayBuffers
	if (typeof ArrayBuffer != "undefined" && data instanceof ArrayBuffer)
		return data;

	switch (getContentTypeEncode(preset)) {
		case "form-encoded":
			const dataArr = [];

			if (typeof data != "object")
				return String(data);
			
			for (const key in data) {
				if (!data.hasOwnProperty(key))
					continue;

				let d = data[key];
	
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

		case "json":
		default:
			if (typeof data == "object")
				return JSON.stringify(data);

			// Else stringify to plain data
			return String(data);
	}
}

function decodeData(xhr) {
	const text = xhr.responseText;

	switch (getContentTypeDecode(xhr)) {
		case "json":
			return JSON.parse(text);
	}

	return text;
}

function getContentTypeEncode(preset) {
	const headers = (preset && preset.headers) || {};
	return normalizeContentType(headers["Content-Type"]);
}

function getContentTypeDecode(xhr) {
	const contentType = xhr.getResponseHeader("content-type") || xhr.getResponseHeader("contenttype");
	return normalizeContentType(contentType);
}

function normalizeContentType(contentType) {
	if (!contentType)
		return null;

	if (contentType.indexOf("x-www-form-urlencoded") > -1)
		return "form-encoded";
	if (contentType.indexOf("application/json") > -1)
		return "json";

	return null;
}

function getState(manager) {
	if (manager.options.state)
		return manager.options.state;
	else
		return new manager.options.stateConstructor(...manager.options.stateArgs);
}

function injectStateDependencies(state, manager) {
	const hooks = manager.pendingPreset && manager.pendingPreset.hooks;

	if (!hooks)
		return;

	for (const k in hooks) {
		if (!hooks.hasOwnProperty(k))
			continue;

		state.hook(k, hooks[k]);
	}
}

function flushHooks(hookable, flush, action) {
	if (Array.isArray(flush)) {
		for (let i = 0, l = flush.length; i < l; i++)
			hookable.clearHooksNS(flush[i]);
	}
}

const defaultXHROptions = {
	noDuplicatePresets: false,
	stateConstructor: XHRState,
	stateArgs: [],
	flush: []
};

XHRState.NULL = new XHRState();

// Just for clarity - XHR is the default XHR manager that
// handles miscellaneous requests. If wanted, new instances
// of XHRManager may be created to deal with specific cases
// and to avoid concurrency issues
const XHR = new XHRManager();

XHRManager.default = XHR;

export {
	XHR,
	XHRManager,
	XHRState,
	encodeData,
	decodeData
};
