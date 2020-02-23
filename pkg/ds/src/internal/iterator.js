import { SYM_ITER_KEY } from "@qtxr/utils/internal";

export default class Iterator {
	constructor(source, nextIdentifier, fetcher) {
		this.source = source;
		this.nextIdentifier = nextIdentifier;
		this.done = false;

		switch (typeof fetcher) {
			case "string":
				if (Iterator.fetchers.hasOwnProperty(fetcher))
					this._fetchNext = Iterator.fetchers[fetcher].bind(this, this, source);
				break;

			case "function":
				this._fetchNext = fetcher.bind(this, this, source);
				break;
		}
	}

	_fetchNext(nextIdentifier = 0) {
		if (nextIdentifier >= this.source.length)
			return null;

		return {
			value: this.source[nextIdentifier],
			nextIdentifier: nextIdentifier + 1
		};
	}

	next() {
		if (this.done) {
			return {
				value: undefined,
				done: true
			};
		}

		const next = this._fetchNext(this.nextIdentifier);
		if (next === null) {
			this.nextIdentifier = undefined;
			this.done = true;
			
			return {
				value: undefined,
				done: true
			};
		}

		this.nextIdentifier = next.nextIdentifier;
		return {
			value: next.value,
			done: false
		};
	}

	[SYM_ITER_KEY]() {
		return this;
	}
}

Iterator.fetchers = {
	// Basic ArrayIterator-like fetchers
	entries: (iter, source, nextIdentifier) => {
		if (nextIdentifier == source.length)
			return null;

		return {
			value: [nextIdentifier, source[nextIdentifier]],
			nextIdentifier: nextIdentifier + 1
		};
	},
	keys: (iter, source, nextIdentifier) => {
		if (nextIdentifier == source.length)
			return null;

		return {
			value: nextIdentifier,
			nextIdentifier: nextIdentifier + 1
		};
	},
	values: (iter, source, nextIdentifier) => {
		if (nextIdentifier == source.length)
			return null;

		return {
			value: source[nextIdentifier],
			nextIdentifier: nextIdentifier + 1
		};
	}
};
