import {
	sym,
	hasOwn,
	isObject
} from "@qtxr/utils";

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

const promiseRuntimeSym = sym("promise runtime");

export default class DeferredPromise {
	constructor(executor) {
		this[promiseRuntimeSym] = {
			status: "pending",
			promise: null,
			resolve: null,
			reject: null
		};

		const runtime = this[promiseRuntimeSym];
		
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
		return this[promiseRuntimeSym].promise.then(onFulfilled, onRejected);
	}

	catch(onRejected) {
		return this[promiseRuntimeSym].promise.catch(onRejected);
	}

	finally(onFinally) {
		return this[promiseRuntimeSym].promise.finally(onFinally);
	}

	dispatchPromise(actionOrConf, confOrPayload) {
		const runtime = this[promiseRuntimeSym];
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
		return PromiseImpl.allSettled(iterable);
	}
}
