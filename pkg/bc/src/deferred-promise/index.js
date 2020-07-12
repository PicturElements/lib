import {
	sym,
	hasOwn,
	isObject,
	setSymbol
} from "@qtxr/utils";
import { Manage } from "../common";

const PromiseImpl = typeof Promise == "undefined" ?
	class PromisePlaceholder {
		then() {
			console.warn("No support for Promise: cannot call then");
			return this;
		}

		catch() {
			console.warn("No support for Promise: cannot call catch");
			return this;
		}

		finally() {
			console.warn("No support for Promise: cannot call finally");
			return this;
		}

		static all() {
			console.warn("No support for Promise: cannot call static method all");
		}

		static allSettled() {
			console.warn("No support for Promise: cannot call static method allSettled");
		}

		static race() {
			console.warn("No support for Promise: cannot call static method race");
		}
	} :
	Promise;

const PROMISE_RUNTIME = sym("promise runtime");

export default class DeferredPromise {
	constructor(options) {
		Manage.instantiate(DeferredPromise, this, options);
	}

	[Manage.CONSTRUCTOR](opt) {
		const executor = opt("executor"),
			runtime = {
				status: "pending",
				promise: null,
				resolve: null,
				reject: null
			};

		setSymbol(this, PROMISE_RUNTIME, runtime);

		runtime.promise = new PromiseImpl((resolve, reject) => {
			runtime.resolve = resolve;
			runtime.reject = reject;

			if (typeof executor == "function") {
				executor(value => {
					runtime.status = "fulfilled";
					return resolve(value);
				}, reason => {
					runtime.status = "rejected";
					return reject(reason);
				});
			}
		});

		if (!runtime.resolve)
			this.dispatchPromise = this.console.warn("No support for Promise: cannot call dispatchPromise");
	}

	then(onFulfilled, onRejected) {
		return this[PROMISE_RUNTIME].promise.then(onFulfilled, onRejected);
	}

	catch(onRejected) {
		return this[PROMISE_RUNTIME].promise.catch(onRejected);
	}

	finally(onFinally) {
		return this[PROMISE_RUNTIME].promise.finally(onFinally);
	}

	dispatchPromise(actionOrConf, confOrPayload) {
		const runtime = this[PROMISE_RUNTIME];
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
		} else if (runtime.status != "pending") {
			console.warn(`Cannot dispatch promise: promise is already ${runtime.status}`);
			return this;
		}

		if (conf.action == "reject" || conf.type == "reject") {
			runtime.status = "rejected";

			if (hasOwn(conf, "reason"))
				runtime.reject(conf.reason);
			else if (hasOwn(conf, "error"))
				runtime.reject(conf.error);
			else
				runtime.reject(conf.payload);
		} else {
			runtime.status = "fulfilled";

			if (hasOwn(conf, "value"))
				runtime.resolve(conf.value);
			else if (hasOwn(conf, "data"))
				runtime.resolve(conf.data);
			else
				runtime.resolve(conf.payload);
		}

		return this;
	}

	static resolve(value) {
		return new this(resolve => {
			resolve(value);
		});
	}

	static reject(reason) {
		return new this((resolve, reject) => {
			reject(reason);
		});
	}

	static all(iterable) {
		return PromiseImpl.all(iterable);
	}

	static allSettled(iterable) {
		return PromiseImpl.allSettled(iterable);
	}

	static race(iterable) {
		return PromiseImpl.race(iterable);
	}
}

Manage.declare(DeferredPromise, {
	name: "DeferredPromise",
	namespace: "deferredPromise",
	proto: ["then", "catch", "finally", "dispatchPromise"],
	static: ["resolve", "reject", "all", "allSettled", "race"]
});
