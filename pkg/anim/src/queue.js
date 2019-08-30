import {
	getTime,
	requestFrame
} from "@qtxr/utils";

class QueueManager {
	constructor() {
		this.queue = [];
		this.lastTick = 0;
		this.runQueue = this.runQueue.bind(this);
	}

	// The requester should have an "enqueued" property
	// Queue will check and set that flag when enqueueing callbacks
	// and then reset it when flushing the queue
	enqueue(requester, callback) {
		if (!this.queue.length) {
			this.requested = true;
			this.lastTick = getTime();
			requestFrame(this.runQueue);
		}

		if (requester.enqueued)
			return;
		requester.enqueued = true;

		this.queue.push({
			requester,
			callback
		});
	}

	// Run AND flush
	runQueue(t) {
		const queue = this.queue,
			tDelta = t - this.lastTick;
		this.queue = [];

		for (let i = 0, l = queue.length; i < l; i++) {
			queue[i].requester.enqueued = false;
			queue[i].callback(t, tDelta, this.lastTick);
		}

		this.lastTick = t;
	}

	flush() {
		const queue = this.queue;

		for (let i = 0, l = queue.length; i < l; i++)
			queue[i].requester.enqueued = false;

		this.queue.length = 0;
	}
}

// Export a default queue so that as many resources as
// possible may use the same animation frames
const Queue = new QueueManager();
export default Queue;

export {
	QueueManager
};
