import { SYM_ITER_KEY } from "@qtxr/utils/internal";

export default class StatelessIterator {
	constructor(source, fetcher) {
		this.source = source;
		this.fetch = fetcher.bind(this, this, source);
		this.done = false;
	}

	next() {
		if (this.done) {
			return {
				value: undefined,
				done: true
			};
		}

		const next = this.fetch();
		if (next === StatelessIterator.EXIT) {
			this.done = true;
			
			return {
				value: undefined,
				done: true
			};
		}

		return {
			value: next,
			done: false
		};
	}

	[SYM_ITER_KEY]() {
		return this;
	}
}

// Unique reference for exiting iteration
StatelessIterator.EXIT = Object.freeze({});
