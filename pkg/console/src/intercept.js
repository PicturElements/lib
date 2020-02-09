import { get } from "@qtxr/utils";
import { Hookable } from "@qtxr/bc";

// This file contains interceptors that intercept
// native APIs and feed data to subscribers

const DEF_TARGET_NAME = "window";

export default class Interceptor extends Hookable {
	constructor() {
		super();
		Interceptor.interceptors.push(this);
	}

	dispatch(args, meta) {
		this.callHooks(`${meta.interceptType}:${meta.key}`, args, meta);
		this.callHooks(meta.interceptType, args, meta);
		this.callHooks(meta.key, args, meta);
		if (meta.path != meta.key)
			this.callHooks(meta.path, args, meta);
		this.callHooks("intercept", args, meta);
	}

	destroy() {
		const idx = Interceptor.interceptors.indexOf(this);
		if (idx > -1)
			Interceptor.interceptors.splice(idx, 1);
	}

	static dispatch(args = [], meta = {}) {
		for (let i = 0, l = Interceptor.interceptors.length; i < l; i++)
			Interceptor.interceptors[i].dispatch(args, meta);
	}
}

Interceptor.interceptors = [];

function applyIntercept(targetPath = DEF_TARGET_NAME, keys = []) {
	if (!targetPath || typeof targetPath != "string") {
		keys = targetPath;
		targetPath = DEF_TARGET_NAME;
	}

	const {
		data: target,
		context
	} = get(window, targetPath, null, "context");
	const proxyMetas = [],
		keyLen = keys.length;

	for (let i = 0; i < keyLen; i++) {
		const key = keys[i],
			isNoop = typeof target[key] != "function",
			method = isNoop ? null : target[key],
			boundMethod = isNoop ? null : method.bind(target);

		const meta = {
			// Required properties
			interceptType: "method",
			key,
			path: targetPath == DEF_TARGET_NAME ? key : `${targetPath}.${key}`,
			// Custom properties
			target,
			targetPath,
			context,
			isNoop,
			method,
			boundMethod,
			proxy: (...args) => {
				const runtimeMeta = Object.assign({}, meta);
				Interceptor.dispatch(args, runtimeMeta);
				if (boundMethod)
					return boundMethod(...args);
			}
		};

		proxyMetas.push(meta);
	}

	for (let i = 0; i < keyLen; i++) {
		const meta = proxyMetas[i];
		target[meta.key] = meta.proxy;
	}
}

// Intercept console
applyIntercept("console", [
	"log",
	"info",
	"warn",
	"error",
	"clear"
]);

// Intercept errors
window.addEventListener("error", e => {
	Interceptor.dispatch([e], {
		interceptType: "globalError",
		key: "Error",
		path: "Error"
	});
});
