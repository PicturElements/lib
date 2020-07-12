import Interpolator from "./interpolator";
import { prepareKeyframes } from "./interpolator-utils";

export default class DiscreteInterpolator extends Interpolator {
	constructor(keyframes) {
		super(keyframes);
		this.useTagging = false;
	}

	doInterpolation(kf, kf2, at, runtime) {
		return kf.value;
	}

	static compile(keyframes, options) {
		keyframes = prepareKeyframes(keyframes, options);

		for (let i = 0, l = keyframes.length; i < l; i++)
			keyframes[i].value = keyframes[i].raw;

		return new DiscreteInterpolator(keyframes);
	}
}
