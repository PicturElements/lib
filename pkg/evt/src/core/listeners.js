import {
	relayEvents,
	triggerEvents,
	shouldDebounce
} from "./common";
import { hasOwn } from "@qtxr/utils";
import EVT from "../evt";

const listeners = [
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

	if (!shouldDebounce(evt, store, listener))
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

	if (!hasOwn(state.keysDict, key)) {
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

	if (hasOwn(state.keysDict, key)) {
		store.state.keys.splice(store.state.keys.indexOf(key), 1);
		delete state.keysDict[key];
		triggerEvents(evt, store, "bindingchange");
	}

	if (!shouldDebounce(evt, store, listener))
		relayEvents(evt, store, listener);
}

function setCoordinate(coord, xOrCoordOrEvt = 0, y = 0) {
	if (xOrCoordOrEvt instanceof Event) {
		const p = xOrCoordOrEvt.touches ?
			xOrCoordOrEvt.touches[0] :
			xOrCoordOrEvt;

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

export default listeners;
