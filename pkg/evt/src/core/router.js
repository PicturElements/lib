import { hasOwn } from "@qtxr/utils";
import EventStore from "./store";
import EventManager from "./manager";

export default class EventRouter {
	constructor(target, storeName = "default", listenerExtend = {}) {
		this.routeName = null;
		this.storeName = storeName;
		this.manager = new EventManager();
		this.store = this.manager.listen(storeName, target, listenerExtend);
		this.routes = {};
		this.registeredListeners = {};

		if (!this.store)
			throw new Error("Failed to create router: invalid arguments passed to listen method");
	}

	route(name, handlers = {}) {
		for (const k in handlers) {
			if (!hasOwn(handlers, k))
				continue;

			const handler = handlers[k];

			if (handler && typeof handler == "object")
				this.store.on(k, mkDirectRoute(handler, name, this, k));
			else if (typeof handler == "function" && !hasOwn(this.registeredListeners, k)) {
				const route = this.store.on(k, mkRouteEndpoint(this, k));

				if (route)
					this.registeredListeners[k] = route;
			}
		}

		this.routes[name] = handlers;

		return this;
	}

	setRoute(mode) {
		if (!mode)
			this.routeName = null;

		if (hasOwn(this.routes, mode))
			this.routeName = mode;
	}
}

function mkDirectRoute(handler, routeName, router, name) {
	return EventStore.wrapHandler(handler, (handler, ...args) => {
		if (!hasOwn(router.routes, router.routeName) || router.routeName != routeName)
			return;

		const route = router.routes[router.routeName];

		if (route && hasOwn(route, name))
			handler(...args);
	});
}

function mkRouteEndpoint(router, name) {
	return (...args) => {
		if (!hasOwn(router.routes, router.routeName))
			return;

		const route = router.routes[router.routeName];

		// This will ignore all routes where the specified handler is an object,
		// as all such handlers are injected separately into the system
		if (route && hasOwn(route, name) && typeof route[name] == "function")
			route[name](...args);
	};
}
