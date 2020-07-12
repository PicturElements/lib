import {
	sym,
	hasOwn
} from "@qtxr/utils";
import deferrer from "./deferrer";

// Constants
const DEFAULT_DEBOUNCE_THRESHOLD = 1000 / 60,
	DEBOUNCE_THRESHOLDS = {
		bindingchange: 0
	},
	LISTENER_MODIFIERS = {
		disabled: {
			disabled: true
		},
		defer: {
			defer: true,
			deferOnce: true,
			deferReplace: false
		}
	};

// Symbols
// Super basic tracker. This key is added to all newly added event handlers and
// serves as an indicator to determine whether a handler is in the system
// This is by no means a bulletproof feature, but it may catch issues in the future
const REG_HANDLER = sym("registered handler"),
	OWN_TRIGGER_KEY = sym("own trigger"),
	OWN_HANDLER_KEY = sym("own handler");

// Event dispatching
function triggerEvents(evt, store, listener) {
	listener = resolveListener(store, listener);

	if (!listener)
		return;

	if (listener.manualDebounce || !shouldDebounce(evt, store, listener))
		resolveCallback(listener, OWN_TRIGGER_KEY, "trigger")(evt, store, listener);
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
		resolveCallback(handler, OWN_HANDLER_KEY, "handler")(evt, store, listener, handler);
		handler.lastTimeStamp = timeStamp;
	}

	listener.lastTimeStamp = timeStamp;
	store.debounceTimeStamps[listener.debounceId] = timeStamp;
}

// Iteration
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

// Checking
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

// Resolving
function resolveListener(store, listener) {
	return (listener && typeof listener == "object") ?
		listener :
		store.getListener(listener);
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

		if (hasOwn(source, key) && typeof callback == "function")
			return callback;
	}

	return null;
}

// General
function warnReturn(returnVal, warning) {
	console.warn(warning);
	return returnVal;
}

function wrapFunction(source, sourceKey, key, wrapper) {
	source[key] = (...args) => wrapper(source[sourceKey], ...args);
	return source;
}

export {
	// Constants
	DEFAULT_DEBOUNCE_THRESHOLD,
	DEBOUNCE_THRESHOLDS,
	LISTENER_MODIFIERS,
	// Symbols
	REG_HANDLER,
	OWN_TRIGGER_KEY,
	OWN_HANDLER_KEY,
	// Event dispatching
	triggerEvents,
	dispatchEvents,
	relayEvents,
	sendEvent,
	// Iteration
	forEachName,
	forEachReverse,
	// Checking
	shouldDebounce,
	shouldDebounceHandler,
	// Resolving
	resolveListener,
	resolveOption,
	resolveCallback,
	// General
	warnReturn,
	wrapFunction
};
