import Interpolator from "./interpolator";
import {
	prepareKeyframes,
	interpolate
} from "./interpolator-utils";

export default class PureInterpolator extends Interpolator {
	constructor(keyframes) {
		super(keyframes);
	}

	doInterpolation(kf, kf2, at, runtime) {
		at = this.getInterpolationPosition(kf, kf2, at);
		return interpolate(kf.value, kf2.value, at, runtime);
	}

	static compile(keyframes, options) {
		const outKeyframes = prepareKeyframes(keyframes, options || {
			clone: true
		});

		return new PureInterpolator(outKeyframes);
	}
}
