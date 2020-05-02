import { hasOwn } from "@qtxr/utils";

const deferrer = {
	queue: [],
	ref: {},
	enqueue(dispatcher, options, ...args) {
		if (typeof dispatcher != "function" || (hasOwn(this.ref, options.key) && !options.replace))
			return true;

		const key = options.key,
			packet = {
				dispatcher,
				args
			};

		if (hasOwn(this.ref, key)) {
			if (options.replace)
				Object.assign(this.ref[key], packet);
		} else {
			this.queue.push(packet);

			if (options.deferOnce)
				this.ref[key] = packet;
		}

		if (this.frame === null)
			requestAnimationFrame(_ => this.dispatch());
	},
	dispatch() {
		for (let i = 0, l = this.queue.length; i < l; i++) {
			const packet = this.queue[i];
			packet.dispatcher.apply(null, packet.args);
		}

		this.queue = [];
		this.ref = {};
		this.frame = null;
	},
	frame: null
};

export default deferrer;
