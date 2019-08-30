import Interpolator from "./interpolator";
import {
	prepareKeyframes,
	getInterpolationPositionRaw
} from "./interpolator-utils";
import { resolveInterpolatorMaker } from "./interpolator-makers";

export default class StyleInterpolator extends Interpolator {
	constructor(keyframes) {
		super(keyframes);
		this.useTagging = false;
	}
	
	doInterpolation(kf, kf2, at, runtime) {
		at = getInterpolationPositionRaw(kf.start, kf.end, at);
		const list = kf.value,
			target = runtime.target || {};

		for (let i = 0, l = list.length; i < l; i++)
			target[list[i].name] = list[i].interpolator.interpolate(at, runtime);

		return target;
	}

	animate(callbackOrNode, ...options) {
		if (callbackOrNode instanceof Node) {
			const node = callbackOrNode,
				style = node.style;

			callbackOrNode = s => {
				for (const k in s) {
					if (s.hasOwnProperty(k))
						style[k] = s[k];
				}
			};
		}

		return super.animate(callbackOrNode, ...options);
	}

	static compile(keyframes) {
		const outKeyframes = prepareKeyframes(keyframes),
			okl = outKeyframes.length;

		for (let i = 0; i < okl; i++) {
			const style = outKeyframes[i].value,
				outStyle = [];

			for (const k in style) {
				if (!style.hasOwnProperty(k) || Interpolator.isReservedKey(k))
					continue;

				const name = propToAttr(k),
					sequence = formatStyleSequence(style[k]);

				outStyle.push({
					name,
					interpolator: resolveInterpolatorMaker(name).make(sequence)
				});
			}

			outKeyframes[i].value = outStyle;
		}

		return new StyleInterpolator(outKeyframes);
	}
}

function propToAttr(prop) {
	return prop.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

function formatStyleSequence(sequence) {
	if (Array.isArray(sequence))
		return sequence;

	if (typeof sequence == "string") {
		return sequence.split(">>")
			.map(s => s.trim())
			.filter(Boolean);
	}

	return [];
}
