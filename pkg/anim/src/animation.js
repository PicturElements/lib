import { resolveArgs } from "@qtxr/utils";
import Ease from "./ease";
import AnimationManager from "./animation-manager";

const defaultManager = new AnimationManager();

const animationConstructorParams = [
	{ name: "manager", type: AnimationManager, default: defaultManager },
	{ name: "handler", type: "function", required: true },
	{ name: "duration", type: "number", default: 1000 },
	{ name: "delay", type: "number", default: 0 },
	{ name: "easing", type: "string|function", default: "linear" }
];

export default class Animation {
	constructor(...args) {
		let {
			manager,
			handler,
			duration,
			delay,
			easing
		} = resolveArgs(args, animationConstructorParams, "allowSingleSource");

		this.manager = manager;
		this.exit = null;
		this.promise = null;

		this.runtime = {
			handler,
			duration,			// animation duration in ms
			delay,				// animation delay in ms (will consume frames)
			easing: Ease.compile(easing),
			position: 0,		// percentage of animation played (required to support time shifting)
			delayPosition: 0,	// same as position, but for delays
			running: true,		// play state (will consume frames but not update runtime variables)
			speed: 1,			// time shifting
			runs: 0,			// number of times the animation has been initialized (.run() calls)
			frames: 0,
			phase: "idle",
			totalTime: delay + duration
		};
	}

	reset() {
		Object.assign(this.runtime, {
			position: 0,
			delayPosition: 0,
			running: true,
			frames: 0,
			phase: "idle"
		});
	}

	run(...args) {
		if (this.runtime.phase != "idle")
			this.exit();

		if (this.runtime.runs)
			this.reset();

		this.runtime.runs++;
		this.runtime.phase = "running";

		if (args.length) {
			const params = [
					{ name: "duration", type: "number", default: this.runtime.duration },
					{ name: "delay", type: "number", default: this.runtime.delay },
					{ name: "easing", type: "string|function", default: this.runtime.easing }
				],
				cachedRuntimeVars = {
					duration: this.runtime.duration,
					delay: this.runtime.delay,
					easing: this.runtime.easing
				};

			Object.assign(this.runtime, resolveArgs(args, params, "allowSingleSource"));
			this.runtime.easing = Ease.compile(this.runtime.easing);

			this.promise = new Promise(resolve => {
				this.exit = v => {
					Object.assign(this.runtime, cachedRuntimeVars);
					resolve(v);
				};
			});
		} else {
			this.promise = new Promise(resolve => {
				this.exit = v => resolve(v);
			});
		}

		this.manager.enqueue(this);
		return this.promise;
	}

	tick(at, t, tDelta, lastTick) {
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
