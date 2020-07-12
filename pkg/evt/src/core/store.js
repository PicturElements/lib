import {
	DEBOUNCE_THRESHOLDS,
	REG_HANDLER,
	OWN_TRIGGER_KEY,
	OWN_HANDLER_KEY,
	relayEvents,
	triggerEvents,
	dispatchEvents,
	forEachName,
	forEachReverse,
	wrapFunction
} from "./common";
import { hasOwn } from "@qtxr/utils";
import {
	listenerMap,
	listenerAliasMap
} from "./processed-listeners";

let evtStoreId = 0;

export default class EventStore {
	constructor({ target, listeners, owner }) {
		this.id = evtStoreId++;
		this.handlerId = 0;
		this.target = target;
		this.listeners = listeners;
		this.owner = owner;

		this.debounceThresholds = Object.assign({}, DEBOUNCE_THRESHOLDS);
		this.debounceTimeStamps = {};
		this.state = {
			pressed: false,
			coords: {
				x: -1,
				y: -1
			},
			prevCoords: {
				x: -1,
				y: -1
			},
			moveDelta: {
				x: 0,
				y: 0
			},
			dragDelta: {
				x: 0,
				y: 0
			},
			keys: [],
			keysDict: {},
			scrollTop: -1,
			scrollLeft: -1
		};

		this.init();
	}

	init() {
		const thresholds = this.debounceThresholds;

		for (const k in thresholds) {
			if (hasOwn(thresholds, k))
				this.debounceTimeStamps[k] = -Infinity;
		}

		this.listeners.forEach(l => {
			const handlers = l.handlers,
				name = l.name;

			l.handlers = [];
			l.applied = false;
			handlers.forEach(h => this.on(name, h));
			l.triggerDispatcher = e => {
				if (!l.disabled)
					triggerEvents(e, this, l);
			};
		});
	}

	on(name, handler) {
		const handlerT = typeof handler,
			targetListeners = [];

		if (!handler || (handlerT != "function" && (handlerT != "object" || typeof handler.handler != "function")))
			return null;

		if (hasOwn(handler, REG_HANDLER)) {
			console.error("Refusing to add handler: handler is already in an EventStore");
			return null;
		}

		if (handlerT == "function")
			handler = { handler };

		handler[REG_HANDLER] = true;
		handler.id = `${this.id}:${this.handlerId++}`;
		handler.lastTimeStamp = -Infinity;

		forEachName(this.listeners, name, l => {
			if (!l.synthetic && !l.applied) {
				this.target.addEventListener(l.name, l.triggerDispatcher, l.eventOptions);
				l.applied = true;
			}

			targetListeners.push(l);
			l.handlers.push(handler);
		});

		handler.listeners = targetListeners;

		return handler;
	}

	off(name, handler) {
		const listener = this.getListener(name) || this.getAListenerByAlias(name),
			handlerFunc = handler && (handler.handler || handler);
		let removed = 0;

		if (!listener)
			return removed;

		const handlers = listener.handlers,
			toVisit = [],
			logged = {};

		forEachReverse(handlers, (h, i) => {
			if (h == handler || h.handler == handlerFunc) {
				h.toBeDeleted = true;
				delete h[REG_HANDLER];
				listener.handlers.splice(i, 1);
				removed++;

				h.listeners.forEach(l => {
					if (l != listener && !hasOwn(logged, l.name)) {
						toVisit.push(l);
						logged[l.name] = true;
					}
				});

				h.listeners = [];
			}
		});

		toVisit.forEach(l => {
			forEachReverse(l.handlers, (h, i) => {
				if (hasOwn(h, "toBeDeleted")) {
					l.handlers.splice(i, 1);
				}
			});
		});

		return removed;
	}

	getListener(name) {
		const listener = hasOwn(listenerMap, name) ?
			this.listeners[listenerMap[name]] :
			null;

		if (hasOwn(listenerMap, name) && listener && listener.name != name)
			console.error("FATAL: map index mismatch");

		return listener;
	}

	getAListenerByAlias(alias) {
		return hasOwn(listenerAliasMap, alias) ?
			this.listeners[listenerAliasMap[alias]] :
			null;
	}

	triggerEvents(evt, listener) {
		return triggerEvents(evt, this, listener);
	}

	dispatchEvents(evt, listener) {
		return dispatchEvents(evt, this, listener);
	}

	relayEvents(evt, listener) {
		return relayEvents(evt, this, listener);
	}

	destroy() {
		this.listeners.forEach(l => {
			l.handlers = [];
			this.target.removeEventListener(l.name, l.triggerDispatcher, l.evtOptions);
		});
	}

	static wrapTrigger(handler, wrapper) {
		if (typeof handler == "function")
			return handler;

		return wrapFunction(handler, "trigger", OWN_TRIGGER_KEY, wrapper);
	}

	static wrapHandler(handler, wrapper) {
		if (typeof handler == "function")
			return handler;

		return wrapFunction(handler, "handler", OWN_HANDLER_KEY, wrapper);
	}
}
