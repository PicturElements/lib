import {
	get,
	queryObj,
	filterMut
} from "@qtxr/utils";
import { Hookable } from "@qtxr/bc";
import {
	StyleInterpolator,
	PureInterpolator
} from "@qtxr/interpolate";

// API:
// ScrollStops takes options as input of the following forms:
// String: selector for scroll target element
// EventTarget: scroll target element
// Object: full options object:
// {
//		elem	(EventTarget):		scroll target element,
//		stops	(Array, Object):	single stop object or array of stop objects; see below
//		handler	(function):			handler that is invoked when updates are necessary
//									The supplied this context is the same as thisVal on the ScrollStops instance
// }
//
// stops object:
// {
//		track	(string)
//				x%:				percentage of scrollable area scrolled (payload.xPerc, payload.yPerc)
//				xv				viewport relative (payload.xRel, payload.yRel)
//				top/left: 		synonymous with "0%"
//				bottom/right:	synonymous with "100%"
//		track	(number)
//				absolute position in pixels from top or left
//		track	(array)
//				range between two track values of any type
//		track	(function)
//				function that returns a track value of any type for dynamic scroll control
//				The supplied this context is the same as thisVal on the ScrollStops instance
//		track	(Node)
//				tracking range for node (not yet implemented)
// }
//
// Payload object:
// {
//		width:				scroll target element width in pixels
//		height:				scroll target element height in pixels
//		left:				scroll left in pixels
//		top: 				scroll top in pixels
//		prev:				previous payload
//		box:				scroll target element DOMRect
//		availableWidth:		scrollable width in pixels
//		availableHeight:	scrollable height in pixels
//		xPerc:				percentage scrolled of available width
//		yPerc:				percentage scrolled of available height
//		xFrac:				percentage scrolled of available width in range
//		yFrac:				percentage scrolled of available height in range
//		xRel:				scrolled distance / viewport width
//		yRel:				scrolled distance / viewport height
//		evt:				source event
//		instance:			ScrollStops instance
// }

export default class ScrollStops extends Hookable {
	constructor(options) {
		super();
		this.stops = [];
		this.handler = null;
		this.options = null;
		this.prev = null;
		this.thisVal = this;

		let selfOptions = options;

		if (options instanceof EventTarget) {
			selfOptions = {
				elem: options
			};
		} else if (typeof options == "string") {
			selfOptions = {
				elem: document.querySelector(options)
			};
		}

		if (!selfOptions || !(selfOptions.elem instanceof EventTarget))
			throw new Error("Cannot initiate ScrollStops: no target element is defined");

		this.init(selfOptions);
	}

	init(options) {
		this.options = options;
		this.handler = e => this.trigger(e);
		options.elem.addEventListener("scroll", this.handler);

		let stops = options.stops || [];
		stops = Array.isArray(stops) ? stops : [stops];
		for (let i = 0, l = stops.length; i < l; i++)
			this.addStop(stops[i]);
	}

	addStop(stop) {
		stop = Object.assign({}, stop);

		if (stop.hasOwnProperty("track"))
			stop.trackY = stop.track;
		if (stop.hasOwnProperty("handler"))
			stop.handlerY = stop.handler;

		stop.trackX = parseTracking(stop.trackX) || null;
		stop.trackY = parseTracking(stop.trackY) || null;

		this.stops.push(stop);
	}

	removeStops(stop) {
		const indices = queryObj(this.stops, stop).indices;
		let ptr = 0;

		filterMut(this.stops, (p, i) => {
			if (i == indices[ptr]) {
				ptr++;
				return false;
			}

			return true;
		});
	}

	trigger(evt) {
		const scrollRef = this.options.elem == document ?
				(document.scrollingElement || document.documentElement) :
				this.options.elem,
			payload = {
				width: scrollRef.scrollWidth,
				height: scrollRef.scrollHeight,
				left: scrollRef.scrollLeft,
				top: scrollRef.scrollTop,
				prev: this.prev,
				box: scrollRef.getBoundingClientRect(),
				evt,
				instance: this
			};

		payload.availableWidth = Math.round(payload.width - payload.box.width);
		payload.availableHeight = Math.round(payload.height - payload.box.height);
		payload.xPerc = (payload.left / payload.availableWidth) || 0;
		payload.yPerc = (payload.top / payload.availableHeight) || 0;
		payload.xRel = (payload.left / payload.box.width) || 0;
		payload.yRel = (payload.top / payload.box.height) || 0;

		if (this.prev)
			this.prev.prev = null;

		for (let i = 0, l = this.stops.length; i < l; i++) {
			const pt = this.stops[i];
			payload.xFrac = resolveFrac(pt.trackX, "x", payload);
			payload.yFrac = resolveFrac(pt.trackY, "y", payload);
			this.doTracking(pt, "x", payload);
			this.doTracking(pt, "y", payload);
		}

		this.prev = payload;
	}

	doTracking(stop, dir, payload) {
		const tracker = stop[dir == "x" ? "trackX" : "trackY"];
		if (!tracker)
			return;
	
		const handler = stop[dir == "x" ? "handlerX" : "handlerY"];
		if (typeof handler != "function")
			return;
		
		if (tracker.shouldHandle(dir, payload))
			handler.call(this.thisVal, payload, this);
	}

	destroy() {
		const options = this.options;
		options.elem.removeEventListener("scroll", this.handler);
	}

	static mkStyleInterpolator(style) {
		const interpolator = StyleInterpolator.compile(style);

		return (stop, start, extent) => {
			const perc = clipNum((stop - start) / extent);
			return interpolator.interpolate(perc);
		};
	}

	static mkPureInterpolator(data) {
		const interpolator = PureInterpolator.compile(data);
		
		return (stop, start, extent) => {
			const perc = clipNum((stop - start) / extent);
			return interpolator.interpolate(perc);
		};
	}

	static wrapInterpolator(style, accessor) {
		const interpolator = ScrollStops.mkStyleInterpolator(style);

		return function(start = 0, extent = null) {
			extent = extent == null ? 1 - start : extent;
			const stop = get(this.$data, accessor);
			return interpolator(stop, start, extent);
		};
	}

	static wrapPureInterpolator(data, accessor) {
		const interpolator = ScrollStops.mkPureInterpolator(data);
		
		return function(start = 0, extent = null) {
			extent = extent == null ? 1 - start : extent;
			const stop = get(this.$data, accessor);
			return interpolator(stop, start, extent);
		};
	}
}

function parseTracking(track) {
	if (track == null)
		return;

	switch (track) {
		case "top":
		case "left":
			track = "0%";
			break;
		case "bottom":
		case "right":
			track = "100%";
			break;
	}

	if (typeof track == "string") {
		const trimmed = track.trim(),
			percEx = /^(\d*.?\d+)%$/.exec(trimmed);

		if (percEx)
			return createTracker("percentage", clipNum(Number(percEx[1]) / 100));

		const relEx = /^(\d*.?\d+)v$/.exec(trimmed);
		if (relEx)
			return createTracker("viewportRelative", Number(relEx[1]));

		const absEx = /^\d*.?\d+$/.exec(trimmed);
		if (absEx)
			return createTracker("absolute", Number(absEx[0]));

		return createTracker("elements", track);
	}
	
	if (Array.isArray(track))
		return createTracker("range", track.map(parseTracking));
	
	if (track instanceof Node)
		return createTracker("elements", [track]);
	
	if (typeof track == "function")
		return createTracker("dynamic", track);

	if (typeof track == "number")
		return createTracker("absolute", track);
}

const trackerDefaults = {
	shouldHandle(dir, payload) {
		const percKey = resolveCoordKey(this, dir);
	
		if (!payload.prev)
			return payload[percKey] >= this.value;
	
		return stopReached(this.value, payload.prev[percKey], payload[percKey]);
	},
	calcFrac(dir, payload) {
		return resolveCoord(this, dir, payload);
	}
};

const trackerMakers = {
	mkDynamicRelayer(key) {
		return function(dir, payload) {
			const trackerData = this.value.call(payload.instance.thisVal, dir, payload),
				tracker = parseTracking(trackerData);

			return tracker[key](dir, payload);
		};
	}
};

const trackerStructs = {
	percentage: {
		shouldHandle: trackerDefaults.shouldHandle,
		calcFrac: trackerDefaults.calcFrac,
		getCoordMap(dir, payload) {
			return dir == "x" ? payload.availableWidth : payload.availableHeight;
		}
	},
	viewportRelative: {
		shouldHandle: trackerDefaults.shouldHandle,
		calcFrac: trackerDefaults.calcFrac,
		getCoordMap(dir, payload) {
			return dir == "x" ? payload.box.width : payload.box.height;
		}
	},
	range: {
		shouldHandle(dir, payload) {
			const start = resolveCoord(this.value[0], dir, payload),
				end = resolveCoord(this.value[1], dir, payload),
				outOfBounds = start.val < start.target || end.val > end.target;

			if (!outOfBounds) {
				this.active = true;
				return true;
			}
			
			if (this.active) {
				this.active = false;
				return true;
			}

			return false;
		},
		calcFrac(dir, payload) {
			const start = this.value[0].calcFrac(dir, payload),
				end = this.value[1].calcFrac(dir, payload);

			return mkFrac(
				end.val - start.target,
				end.target - start.target
			);
		},
		getCoordMap: _ => 1
	},
	dynamic: {
		shouldHandle: trackerMakers.mkDynamicRelayer("shouldHandle"),
		calcFrac: trackerMakers.mkDynamicRelayer("calcFrac"),
		getCoordMap: trackerMakers.mkDynamicRelayer("getCoordMap")
	},
	absolute: {
		shouldHandle: trackerDefaults.shouldHandle,
		calcFrac: trackerDefaults.calcFrac,
		getCoordMap: _ => 1
	}
};

function createTracker(trackerType, value) {
	return Object.assign({
		type: trackerType,
		active: true,
		value
	}, trackerStructs[trackerType]);
}

const trackMap = {
	percentage: {x: "xPerc", y: "yPerc"},
	viewportRelative: {x: "xRel", y: "yRel"},
	absolute: {x: "left", y: "top"}
};

function resolveCoordKey(tracker, dir) {
	const trackKeys = trackMap[tracker.type];

	if (!trackKeys)
		throw new Error(`Cannot resolve coordinate: Track type '${tracker.type}' does not describe a stop`);

	return trackKeys[dir];
}

function resolveCoord(tracker, dir, payload) {
	const key = resolveCoordKey(tracker, dir),
		coordMap = tracker.getCoordMap(dir, payload);

	return mkFrac(
		payload[key] * coordMap,
		tracker.value * coordMap
	);
}

function mkFrac(val, target) {
	return {
		val,
		target
	};
}

function resolveFrac(tracker, dir, payload) {
	if (!tracker)
		return null;

	const frac = tracker.calcFrac(dir, payload);

	if (!frac.val || !frac.target)
		return 0;

	return clipNum(frac.val / frac.target);
}

function stopReached(stop, prev, curr) {
	return prev != curr && ((curr >= stop && prev < stop) || (curr <= stop && prev > stop));
}

function clipNum(val, min = 0, max = 1) {
	return Math.max(Math.min(val, max), min);
}
