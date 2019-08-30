import Color from "@qtxr/color";
import Interpolator from "./interpolator";
import { 
	prepareKeyframes,
	interpolate
} from "./interpolator-utils";

export default class BasicInterpolator extends Interpolator {
	constructor(keyframes) {
		super(keyframes);
		this.useTagging = false;
	}
	
	doInterpolation(kf, kf2, at, runtime) {
		at = this.getInterpolationPosition(kf, kf2, at);
		return interpolate(kf.value, kf2.value, at, runtime);
	}

	format(type) {
		switch(type) {
			case "number":
				runFormat(this.keyframes, Number);
				break;
			case "color":
				runFormat(this.keyframes, c => new Color(c));
				break;
		}

		return this;
	}

	static compile(keyframes, options) {
		keyframes = prepareKeyframes(keyframes, options);

		for (let i = 0, l = keyframes.length; i < l; i++)
			keyframes[i].value = keyframes[i].raw;
		
		return new BasicInterpolator(keyframes);
	}
}

function runFormat(keyframes, callback) {
	for (let i = 0, l = keyframes.length; i < l; i++)
		keyframes[i].value = callback(keyframes[i].value, i, keyframes);
}
