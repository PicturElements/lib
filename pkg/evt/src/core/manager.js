import {
	LISTENER_MODIFIERS,
	warnReturn
} from "./common";
import { hasOwn } from "@qtxr/utils";
import listenerList from "./listeners";
import EventStore from "./store";

export default class EventManager {
	constructor() {
		this.stores = {};
	}

	listen(name, target, listenerExtend = {}) {
		if (!name || typeof name != "string")
			return warnReturn(null, "Cannot listen: name is not valid");
		if (!(target instanceof EventTarget))
			return warnReturn(null, "Cannot listen: event target is not valid (must be an EventTarget)");

		const listeners = listenerList.map(l => {
			const extend = listenerExtend[l.name],
				override = {
					defaultTrigger: l.trigger,
					debounceId: l.debounceId,
					handlers: []
				};
			let listener = null;

			if (!hasOwn(listenerExtend, name))
				listener = Object.assign({}, l);
			else if (extend && typeof extend == "object") {
				listener = Object.assign({}, l, extend);
				// Doesn't matter that we copy the reference to the extend handlers,
				// because EventStore will create a new array on init
				override.handlers = Array.isArray(extend.handlers) ?
					extend.handlers :
					override.handlers;
			} else
				listener = Object.assign({}, l, LISTENER_MODIFIERS[extend] || LISTENER_MODIFIERS.disabled);

			return Object.assign(listener, override);
		});

		const store = new EventStore({
			target,
			listeners,
			owner: this
		});

		this.stores[name] = store;
		return store;
	}

	mute(name) {
		if (!hasOwn(this.stores, name))
			return false;

		this.stores[name].destroy();
		delete this.stores[name];

		return true;
	}

	getStore(name) {
		return hasOwn(this.stores, name) ?
			this.stores[name] :
			null;
	}
}
