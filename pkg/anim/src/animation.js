import { isObject } from "@qtxr/utils";
import Ease from "./ease";

export default class Animation {
	constructor(handlerOrRuntime, durationOrRuntime, delayOrRuntime, easingOrRuntime) {
		this.promise = new Promise(resolve => {
			this.exit = v => resolve(v);
		});

		if (Ease.isEasingData(delayOrRuntime)) {
			easingOrRuntime = delayOrRuntime;
			delayOrRuntime = 0;
		}

		const runtimeSources = [
			handlerOrRuntime,
			durationOrRuntime,
			delayOrRuntime,
			easingOrRuntime
		].filter(isObject);

		const runtime = Object.assign({
			handler: typeof handlerOrRuntime == "function" ? handlerOrRuntime : null,
			duration: typeof durationOrRuntime == "number" ? durationOrRuntime : 0,		// animation duration in ms
			delay: typeof delayOrRuntime == "number" ? delayOrRuntime : 0,				// animation delay in ms (will consume frames)
			easing: Ease.isEasingData(easingOrRuntime) ? easingOrRuntime : "linear",
			position: 0,		// percentage of animation played (required to support time shifting)
			delayPosition: 0,	// same as position, but for delays
			running: true,		// play state (will consume frames but not update runtime variables)
			speed: 1			// time shifting
		}, ...runtimeSources);
		
		runtime.frames = 0;
		runtime.phase = "running";
		runtime.totalTime = runtime.delay + runtime.duration;

		this.runtime = runtime;
		runtime.easing = Ease.compile(runtime.easing);
	}

	run(at, t, tDelta, lastTick) {
		if (typeof this.runtime.handler == "function")
			this.runtime.handler(at, t, tDelta, lastTick, this);
	}

	setPlayState(running) {
		running = !!running;

		if (this.runtime.running == running)
			return;

		this.runtime.running = running;
	}

	get running() {
		return this.runtime.running;
	}

	set running(running) {
		this.setPlayState(running);
	}
}
