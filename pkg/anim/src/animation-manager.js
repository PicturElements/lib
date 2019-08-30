import { filterMut } from "@qtxr/utils";
import Ease from "./ease";
import Queue from "./queue";

export default class AnimationManager {
	constructor() {
		this.dropped = true;
		this.lastT = 0;
		this.queue = [];
		// Required by Queue, see ./queue.js
		this.enqueued = false;
		this.tick = this.tick.bind(this);
	}
	
	requestTick() {
		Queue.enqueue(
			this,
			this.tick
		);
	}

	tick(t, tDelta, lastTick) {
		filterMut(this.queue, animation => {
			const runtime = animation.runtime;

			if (runtime.delay && runtime.delayPosition < 1) {
				runtime.delayPosition += (Math.abs(runtime.speed) * tDelta) / runtime.delay;

				// Call once to reset animation
				if (!runtime.frames) {
					runtime.frames++;
					runtime.phase = "delayed";
					animation.run(0, t, 0, t);
				}
				
				if (runtime.delayPosition < 1) {
					return true;
				} else
					runtime.phase = "running";
			}

			runtime.position = (runtime.position + (runtime.speed * tDelta) / runtime.duration) || 0;

			const exitBcZeroDuration = (runtime.delay && runtime.delayPosition < 1) || !runtime.duration,
				exitBcExceededPositivePos = runtime.speed > 0 && runtime.position >= 1,
				exitBcExceededNegativePos = runtime.speed < 0 && runtime.position <= 0;


			animation.run(
				Ease.ease(runtime.easing, runtime.position),
				t,
				tDelta,
				lastTick
			);

			if (exitBcZeroDuration || exitBcExceededPositivePos || exitBcExceededNegativePos) {
				this.runEndOfAnimation(animation);
				return false;
			}

			return true;
		});

		this.tickRequested = false;
		if (this.queue.length)
			this.requestTick();
		else
			this.dropped = true;
	}

	enqueue(animation) {
		this.queue.push(animation);
		this.requestTick();
	}

	runEndOfAnimation(animation) {
		animation.runtime.phase = "exited";
		animation.exit(animation);
	}
}
