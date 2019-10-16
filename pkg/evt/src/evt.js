import {
	clone,
	getConstructorName
} from "@qtxr/utils";

const internalKCodeMap = {
		8: "backspace",
		13: "enter",
		16: "shift",
		17: "control",
		18: "alt",
		20: "capslock",
		27: "escape",
		32: "space",
		35: "end",
		36: "home",
		37: "left",
		38: "up",
		39: "right",
		40: "down",
		46: "delete"
	},
	convertMap = {
		esc: "escape",
		spacebar: "space",
		" ": "space",
		arrowleft: "left",
		arrowright: "right",
		arrowup: "up",
		arrowdown: "down",
		metaleft: "meta",
		metaright: "meta",
		controlleft: "control",
		controlright: "control",
		shiftleft: "shift",
		shiftright: "shift"
	},
	keyTests = {
		ctrl: /c(on)?tro?l\+/gi,
		alt: /alt\+/gi,
		shift: /shift\+/gi,
		meta: /cmd\+/gi
	},
	keyProps = {
		ctrl: "ctrlKey",
		alt: "altKey",
		shift: "shiftKey",
		meta: "metaKey"
	};

const EVT = {
	is(evt) {
		const name = getConstructorName(evt);

		switch (name) {
			case "KeyboardEvent":
				return isHotkeyMulti.apply(this, arguments);
		}
		return false;
	},

	getKey(evt, bare) {
		const name = getConstructorName(evt);

		switch (name) {
			case "KeyboardEvent":
				return getKey(evt, bare);
		}

		return null;
	},

	getCoords(evt, elem) {
		// internalCoordData is used because touchend doesn't provide coordinates
		// for touch points whereas mouseup does and consistency is needed
		// Alternatively, if the event is the same as the one already logged, just return the
		// calculated value
		let point = null;

		if (this.internalCoordData.evt == evt || (evt.touches && !("clientX" in evt) && evt.touches.length == 0))
			point = clone(this.internalCoordData.point);
		else {
			const e = (evt.touches || [evt])[0];
			point = {
				x: e.clientX,
				y: e.clientY,
				xRaw: e.clientX,
				yRaw: e.clientY
			};
		}

		if (elem) {
			const bcr = elem.getBoundingClientRect();
			point.x = point.xRaw - bcr.left;
			point.y = point.yRaw - bcr.top;
		}

		this.internalCoordData = {
			point: point,
			evt: evt
		};

		return point;
	},

	addEvt(elem, name, handler) {
		elem.removeEventListener(name, handler);
		elem.addEventListener(name, handler);
	},

	internalCoordData: {
		point: {
			x: -100,
			y: -100,
			xRaw: -100,
			yRaw: -100
		},
		evt: null
	}
};

function isKey(evt, key, keys, bare) {
	keys = keys || {};

	for (const k in keyProps) {
		if (keyProps.hasOwnProperty(k) && keys[k] && !evt[keyProps[k]])
			return false;
	}

	key = key.toLowerCase();

	return getKey(evt, bare) === key;
}

function getKey(evt, bare) {
	// Return the bare key
	if (bare === true && evt.code) {
		const code = evt.code.toLowerCase();
		let key = code;

		if (code.indexOf("key") == 0)
			key = code.substr(3);
		else if (code.indexOf("digit") == 0)
			key = code.substr(5);

		return coerceKeyName(key);
	}

	if (evt.key)
		return coerceKeyName(evt.key.toLowerCase());

	const kc = getKeyCode(evt),
		kMap = internalKCodeMap[kc];

	if (kMap)
		return kMap;

	if (kc >= 65 && kc <= 90)
		return String.fromCharCode(kc + 32);
	if (kc >= 48 && kc <= 57)
		return String.fromCharCode(kc);

	return null;
}

function coerceKeyName(key) {
	if (convertMap.hasOwnProperty(key))
		return convertMap[key];
	return key;
}

function getKeyCode(evt) {
	return evt.which || evt.keyCode || evt.charCode || 0;
}

function isHotkeyMulti(evt, first, ...rest) {
	if (!isHotkey(evt, first, true))
		return false;

	for (let i = 0, l = rest.length; i < l; i++) {
		if (isHotkey(evt, rest[i], true))
			return true;
	}

	return true;
}

const modifierKeys = {
	alt: true,
	shift: true
};

function isHotkey(evt, key, enforceModifierKey) {
	const keys = {
		ctrl: false,
		alt: false,
		shift: false,
		meta: false
	};
	let bare = false;

	for (const k in keyTests) {
		if (keyTests.hasOwnProperty(k) && keyTests[k].test(key)) {
			keys[k] = true;
			key = key.replace(keyTests[k], "");
			bare = (!!enforceModifierKey) && modifierKeys.hasOwnProperty(k);
		}
	}

	return isKey(evt, key, keys, bare);
}

// Polyfills: Object.assign, Array.proto.findIndex

const listenerList = [
	{
		name: "mousedown",
		alias: "down",
		debounceId: "down",
		trigger: down
	}, {
		name: "touchstart",
		alias: "down",
		debounceId: "down",
		trigger: down
	}, {
		name: "mousemove",
		alias: "move",
		debounceId: "move",
		trigger: move
	}, {
		name: "touchmove",
		alias: "move",
		debounceId: "move",
		trigger: move,
		manualDebounce: true
	}, {
		name: "drag",
		debounceId: "drag",
		trigger: drag,
		synthetic: true,
		manualDebounce: true
	}, {
		name: "mouseup",
		alias: "up",
		debounceId: "up",
		trigger: up
	}, {
		name: "touchend",
		alias: "up",
		debounceId: "up",
		trigger: up
	}, {
		name: "click",
		debounceId: "click",
		trigger: relayEvents
	}, {
		name: "dblclick",
		debounceId: "dblclick",
		trigger: relayEvents
	}, {
		name: "scroll",
		debounceId: "scroll",
		trigger: scroll,
		defer: true,
		deferOnce: true,
		deferReplace: true
	}, {
		name: "keydown",
		debounceId: "keydown",
		trigger: keydown,
		manualDebounce: true
	}, {
		name: "keyup",
		debounceId: "keyup",
		trigger: keyup,
		manualDebounce: true
	}, {
		name: "bindingchange",
		debounceId: "bindingchange",
		synthetic: true,
		trigger: relayEvents
	}
];

const defaultThreshold = 1000 / 60,
	listenerMap = {},
	debounceThresholds = {
		bindingchange: 0
	};
	
listenerList.forEach((l, i) => {
	listenerMap[l.name] = i;

	if (!debounceThresholds.hasOwnProperty(l.debounceId))
		debounceThresholds[l.debounceId] = defaultThreshold;
});

const listenerAliasMap = {};
listenerList.forEach((l, i) => {
	if (typeof l.alias == "string")
		listenerAliasMap[l.alias] = i;
	else if (Array.isArray(l.alias))
		l.alias.forEach(a => typeof a == "string" && (listenerAliasMap[a] = i));
});

const listenerModifiers = {
	disabled: {
		disabled: true
	},
	defer: {
		defer: true,
		deferOnce: true,
		deferReplace: false
	}
};

const deferrer = {
	queue: [],
	ref: {},
	enqueue(dispatcher, options, ...args) {
		if (typeof dispatcher != "function" || (this.ref.hasOwnProperty(options.key) && !options.replace))
			return true;

		const key = options.key,
			packet = {
				dispatcher,
				args
			};

		if (this.ref.hasOwnProperty(key)) {
			if (options.replace)
				Object.assign(this.ref[key], packet);
		} else {
			this.queue.push(packet);

			if (options.deferOnce)
				this.ref[key] = packet;
		}

		if (this.frame === null)
			requestAnimationFrame(_ => this.dispatch());
	},
	dispatch() {
		for (let i = 0, l = this.queue.length; i < l; i++) {
			const packet = this.queue[i];
			packet.dispatcher.apply(null, packet.args);
		}

		this.queue = [];
		this.ref = {};
		this.frame = null;
	},
	frame: null
};

// Super basic tracker. This key is added to all newly added event handlers and 
// serves as an indicator to determine whether a handler is in the system
// This is by no means a bulletproof feature, but it may catch issues in the future
const registeredHandler = mkSymbol("registered handler", "registered-handler"),
	ownTriggerKey = mkSymbol("own trigger", "own-trigger"),
	ownHandlerKey = mkSymbol("own handler", "own-handler");

function down(evt, store, listener) {
	const state = store.state;
	state.pressed = true;
	setCoordinate(state.prevCoords, store.coords);
	setCoordinate(state.coords, evt);
	setCoordinate(state.moveDelta, 0, 0);
	setCoordinate(state.dragDelta, 0, 0);
	relayEvents(evt, store, listener);
}

function move(evt, store, listener) {
	const state = store.state;
	setCoordinate(state.prevCoords, state.coords);
	setCoordinate(state.coords, evt);
	setCoordinateDelta(state.moveDelta, state.prevCoords, state.coords);

	if (shouldDebounce(evt, store, listener))
		relayEvents(evt, store, listener);

	triggerEvents(evt, store, "drag");
}

function drag(evt, store, listener) {
	if (shouldDebounce(evt, store, listener))
		return;

	const state = store.state;
	setCoordinateSum(state.dragDelta, state.moveDelta);

	if (state.pressed)
		relayEvents(evt, store, listener);
}

function up(evt, store, listener) {
	store.state.pressed = false;
	relayEvents(evt, store, listener);
}

function scroll(evt, store, listener) {
	const scrolling = document.scrollingElement || document.documentElement,
		state = store.state;

	state.scrollTop = scrolling.scrollTop;
	state.scrollLeft = scrolling.scrollLeft;
	relayEvents(evt, store, listener);
}

function keydown(evt, store, listener) {
	const key = EVT.getKey(evt),
		state = store.state;

	if (!state.keysDict.hasOwnProperty(key)) {
		store.state.keys.push(key);
		state.keysDict[key] = true;
		triggerEvents(evt, store, "bindingchange");
	}

	if (!shouldDebounce(evt, store, listener))
		relayEvents(evt, store, listener);
}

function keyup(evt, store, listener) {
	const key = EVT.getKey(evt),
		state = store.state;

	if (state.keysDict.hasOwnProperty(key)) {
		store.state.keys.splice(store.state.keys.indexOf(key), 1);
		delete state.keysDict[key];
		triggerEvents(evt, store, "bindingchange");
	}

	if (!shouldDebounce(evt, store, listener))
		relayEvents(evt, store, listener);
}

function triggerEvents(evt, store, listener) {
	listener = resolveListener(store, listener);

	if (!listener)
		return;

	if (listener.manualDebounce || !shouldDebounce(evt, store, listener))
		resolveCallback(listener, ownTriggerKey, "trigger")(evt, store, listener);
}

function dispatchEvents(evt, store, listener) {
	listener = resolveListener(store, listener);

	if (!listener)
		return;

	const handlers = listener.handlers;

	for (let i = 0, l = handlers.length; i < l; i++)
		sendEvent(evt, store, listener, handlers[i]);
}

function relayEvents(evt, store, listener) {
	listener = resolveListener(store, listener);

	if (!listener)
		return;

	const handlers = listener.handlers;

	for (let i = 0, l = handlers.length; i < l; i++) {
		const handler = handlers[i],
			options = {
				key: handler.id,
				once: resolveOption(handler.deferOnce, listener.deferOnce),
				replace: resolveOption(handler.deferReplace, listener.deferReplace)
			};

		if (resolveOption(handler.defer, listener.defer))
			deferrer.enqueue(sendEvent, options, evt, store, listener, handler);
		else
			sendEvent(evt, store, listener, handler);
	}
}

function sendEvent(evt, store, listener, handler) {
	const timeStamp = evt.timeStamp;

	if (!shouldDebounceHandler(evt, handler)) {
		resolveCallback(handler, ownHandlerKey, "handler")(evt, store, listener, handler);
		handler.lastTimeStamp = timeStamp;
	}

	listener.lastTimeStamp = timeStamp;
	store.debounceTimeStamps[listener.debounceId] = timeStamp;
}

class EventManager {
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
			
			if (!listenerExtend.hasOwnProperty(name))
				listener = Object.assign({}, l);
			else if (extend && typeof extend == "object") {
				listener = Object.assign({}, l, extend);
				// Doesn't matter that we copy the reference to the extend handlers,
				// because EventStore will create a new array on init
				override.handlers = Array.isArray(extend.handlers) ? extend.handlers : override.handlers;
			} else
				listener = Object.assign({}, l, listenerModifiers[extend] || listenerModifiers.disabled);
			
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
		if (!this.stores.hasOwnProperty(name))
			return false;

		this.stores[name].destroy();
		delete this.stores[name];

		return true;
	}

	getStore(name) {
		return this.stores.hasOwnProperty(name) ? this.stores[name] : null;
	}
}

class EventRouter {
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
			if (!handlers.hasOwnProperty(k))
				continue;

			const handler = handlers[k];

			if (handler && typeof handler == "object")
				this.store.on(k, mkDirectRoute(handler, name, this, k));
			else if (typeof handler == "function" && !this.registeredListeners.hasOwnProperty(k)) {
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

		if (this.routes.hasOwnProperty(mode))
			this.routeName = mode;
	}
}

function mkDirectRoute(handler, routeName, router, name) {
	return EventStore.wrapHandler(handler, (handler, ...args) => {
		if (!router.routes.hasOwnProperty(router.routeName) || router.routeName != routeName)
			return;

		const route = router.routes[router.routeName];

		if (route && route.hasOwnProperty(name))
			handler(...args);
	});
}

function mkRouteEndpoint(router, name) {
	return (...args) => {
		if (!router.routes.hasOwnProperty(router.routeName))
			return;

		const route = router.routes[router.routeName];

		// This will ignore all routes where the specified handler is an object,
		// as all such handlers are injected separately into the system
		if (route && route.hasOwnProperty(name) && typeof route[name] == "function")
			route[name](...args);
	};
}

let evtStoreId = 0;

class EventStore {
	constructor({target, listeners, owner}) {
		this.id = evtStoreId++;
		this.handlerId = 0;
		this.target = target;
		this.listeners = listeners;
		this.owner = owner;

		this.debounceThresholds = Object.assign({}, debounceThresholds);
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
			if (thresholds.hasOwnProperty(k))
				this.debounceTimeStamps[k] = -Infinity;
		}


		this.listeners.forEach(l => {
			const handlers = l.handlers,
				name = l.name;

			l.handlers = [];
			handlers.forEach(h => this.on(name, h));
			l.triggerDispatcher = e => {
				if (!l.disabled)
					triggerEvents(e, this, l);
			};

			if (!l.synthetic)
				this.target.addEventListener(name, l.triggerDispatcher, l.eventOptions);
		});
	}

	on(name, handler) {
		const handlerT = typeof handler,
			targetListeners = [];

		if (!handler || (handlerT != "function" && (handlerT != "object" || typeof handler.handler != "function")))
			return null;

		if (handler.hasOwnProperty(registeredHandler)) {
			console.error("Refusing to add handler: handler is already in an EventStore");
			return null;
		}

		if (handlerT == "function")
			handler = { handler };

		handler[registeredHandler] = true;
		handler.id = `${this.id}:${this.handlerId++}`;
		handler.lastTimeStamp = -Infinity;

		forEachName(this.listeners, name, l => {
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
				delete h[registeredHandler];
				listener.handlers.splice(i, 1);
				removed++;

				h.listeners.forEach(l => {
					if (l != listener && !logged.hasOwnProperty(l.name)) {
						toVisit.push(l);
						logged[l.name] = true;
					}
				});

				h.listeners = [];
			}
		});

		toVisit.forEach(l => {
			forEachReverse(l.handlers, (h, i) => {
				if (h.hasOwnProperty("toBeDeleted")) {
					l.handlers.splice(i, 1);
				}
			});
		});

		return removed;
	}

	getListener(name) {
		const listener = listenerMap.hasOwnProperty(name) ? this.listeners[listenerMap[name]] : null;

		if (listenerMap.hasOwnProperty(name) && listener && listener.name != name)
			console.error("FATAL: map index mismatch");

		return listener;
	}

	getAListenerByAlias(alias) {
		return listenerAliasMap.hasOwnProperty(alias) ? this.listeners[listenerAliasMap[alias]] : null;
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

		return wrapFunction(handler, "trigger", ownTriggerKey, wrapper);
	}

	static wrapHandler(handler, wrapper) {
		if (typeof handler == "function")
			return handler;

		return wrapFunction(handler, "handler", ownHandlerKey, wrapper);
	}
}

function forEachName(listeners, name, callback) {
	for (let i = 0, l = listeners.length; i < l; i++) {
		const listener = listeners[i],
			alias = listener.alias;

		if (listener.name == name || alias == name || Array.isArray(alias) && alias.indexOf(name) > -1)
			callback(listener, i, listeners);
	}
}

function forEachReverse(arr, callback) {
	for (let i = arr.length - 1; i >= 0; i--)
		callback(arr[i], i, arr);
}

function warnReturn(returnVal, warning) {
	console.warn(warning);
	return returnVal;
}

function mkSymbol(symbolKey, attrKey) {
	return typeof Symbol == "undefined" ? `${attrKey}-${(1e6 + Math.floor(Math.random() * 1e8)).toString(36)}` : Symbol(symbolKey);
}

function wrapFunction(source, sourceKey, key, wrapper) {
	source[key] = (...args) => wrapper(source[sourceKey], ...args);
	return source;
}

function shouldDebounce(evt, store, listener, handler) {
	let threshold = store.debounceThresholds[listener.debounceId];

	if (handler && typeof handler.debounce == "number")
		return handler.debounce > evt.timeStamp - handler.lastTimeStamp;

	if (typeof listener.debounce == "number")
		threshold = listener.debounce;
	
	return threshold > evt.timeStamp - store.debounceTimeStamps[listener.debounceId];
}

function shouldDebounceHandler(evt, handler) {
	if (handler && typeof handler.debounce == "number")
		return handler.debounce > evt.timeStamp - handler.lastTimeStamp;

	return false;
}

function resolveListener(store, listener) {
	return (listener && typeof listener == "object") ? listener : store.getListener(listener);
}

function resolveOption(...options) {
	for (let i = 0, l = options.length; i < l; i++) {
		if (options[i] !== undefined)
			return options[i];
	}

	return options[options.length - 1];
}

function resolveCallback(source, ...keys) {
	for (let i = 0, l = keys.length; i < l; i++) {
		const key = keys[i],
			callback = source[key];

		if (source.hasOwnProperty(key) && typeof callback == "function")
			return callback;
	}

	return null;
}

function setCoordinate(coord, xOrCoordOrEvt = 0, y = 0) {
	if (xOrCoordOrEvt instanceof Event) {
		const p = xOrCoordOrEvt.touches ? xOrCoordOrEvt.touches[0] : xOrCoordOrEvt;
		coord.x = p.clientX;
		coord.y = p.clientY;
	} else if (typeof xOrCoordOrEvt == "object") {
		coord.x = xOrCoordOrEvt.x;
		coord.y = xOrCoordOrEvt.y;
	} else {
		coord.x = xOrCoordOrEvt;
		coord.y = y;
	}
}

function setCoordinateDelta(coord, a, b) {
	coord.x = b.x - a.x;
	coord.y = b.y - a.y;
}

function setCoordinateSum(coord, a, b = coord) {
	coord.x = a.x + b.x;
	coord.y = a.y + b.y;
}

export {
	EventManager,
	EventRouter,
	EventStore
};

export default EVT;
