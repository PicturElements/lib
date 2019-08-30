import {
	Animation,
	AnimationManager
} from "@qtxr/anim";

export default class InterpolatorAnimation extends Animation {
	constructor(interpolator, ...args) {
		super(...args);
		this.interpolator = interpolator;
		InterpolatorAnimation.manager.enqueue(this);
	}

	run(at, t, tDelta, lastTick) {
		const interpolated = this.interpolator.interpolate(at, this.runtime);

		if (typeof this.runtime.handler == "function")
			this.runtime.handler(interpolated, at, t, tDelta, lastTick, this);
	}
}

InterpolatorAnimation.manager = new AnimationManager();
