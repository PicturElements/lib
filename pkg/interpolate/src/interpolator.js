import {
	binarySearch,
	isObject
} from "@qtxr/utils";
import { Ease } from "@qtxr/anim";
import { getInterpolationPosition } from "./interpolator-utils";
import interpolatorData from "./interpolator-data";
import InterpolatorAnimation from "./interpolator-animation";

// Interpolator API / structure
//
// -- tagging --
// By default, Interpolator tags output where possible. Tagging in this instance refers to appending
// metadata to the output, for use in fine grained animation controls.
// If tagging is enabled (flag: useTagging), interpolate() will add
// the following data iff the returned data is an object:
// - interAt: inter-keyframe position [0-1)
// - debounce: flag describing if the current inter-keyframe position is identical to the previous position
// Both of these are applied only if there's not already a property with the corresponding key on the object
//
// -- control keys --
// Similar to tagged keyframes, there are a few keys that control interpolation:
// at:		the main value controlling interpolation progess
//			(float: recommended range: [0-1], default: extrapolated from keyframe context)
// easing:	easing (timing function) describing the rate of interpolation progress.
//			Easings are applied from the start keyframe and run through to the next
//			(string: keyword, cubic bézier curve points, default: linear)
//
// -- API guidelines --
// doInterpolate: doInterpolate must accept any two keyframes and successfully interpolate between them

export default class Interpolator {
	constructor(keyframes) {
		this.keyframes = keyframes;
		this.keyframesLength = keyframes.length;
		this.units = {};
		this.lastPosition = -1;
		this.currentKeyframe = keyframes[0];
		// Flags
		this.useTagging = true;
	}

	interpolate(at = 0, runtime = {}) {
		let from = this.currentKeyframe;

		if (this.keyframesLength > 1 && (at < from.start || at >= from.end)) {
			const idx = Math.max(binarySearch(this.keyframes, kf => kf.at - at), 0);
			from = this.keyframes[idx];
			this.currentKeyframe = from;
		}

		const interpolated = this.doInterpolation(from, from.next, at, runtime);
		this.tag(from, from.next, at, interpolated);
		return interpolated;
	}

	tag(from, to, at, interpolated) {
		if (!this.useTagging || !isObject(interpolated))
			return;

		const interPos = getInterpolationPosition(from, to, at);

		if (!interpolated.hasOwnProperty("interAt"))
			interpolated.interAt = interPos;

		if (!interpolated.hasOwnProperty("debounce"))
			interpolated.debounce = interPos == this.lastPosition;

		this.lastPosition = interPos;
	}

	extrapolateKeyframes(keyframes) {

	}

	doInterpolation(kf, kf2, at, runtime) {
		console.error("This Interpolator doesn't implement an instance method doInterpolation()");
	}

	doExtrapolation() {
		console.error("This Interpolator doesn't implement an instance method doExtrapolation()");
	}

	animate(callback, ...options) {
		return new InterpolatorAnimation(this, callback, ...options).promise;
	}

	getInterpolationPosition(keyframe, keyframe2, at) {
		at = getInterpolationPosition(keyframe, keyframe2, at);
		at = Ease.ease(keyframe2.easing, at);
		return at;
	}

	static isReservedKey(key) {
		return Interpolator.reservedKeys.hasOwnProperty(key);
	}

	// Compile may accept a number of different formats.
	// Most common are Array[keyframes], raw object, CSS keyframe syntax
	static compile() {
		console.error("This Interpolator doesn't implement a static method compile()");
	}

	// If one keyframe is supplied to this function, it's assumed that
	// it's supposed to be used as the singular argument to compile(),
	// and so only that is passed
	// Otherwise, the entire argument array is passed
	// The reason why this is okay is because normalizeKeyframes will
	// automatically normalize keyframes to array format no matter
	// the input, so it's safer to pass an erroneously non-wrapped
	// input than an erroneously wrapped input
	static c(...keyframes) {
		if (keyframes.length == 1)
			return this.compile(keyframes[0]);
			
		return this.compile(keyframes);
	}
}

Interpolator.animations = [];
Interpolator.reservedKeys = interpolatorData.reservedKeys;
Interpolator.reservedKeysList = interpolatorData.reservedKeysList;
