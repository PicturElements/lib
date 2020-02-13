import { SYM_ITER_KEY } from "@qtxr/utils/internal";

export default class MapSetIterator {
	constructor(source, nextIdentifier, fetchNext) {
		this.source = source;
		this._nextIdentifier = nextIdentifier;
		this._done = false;
		this._customFetchNext = (typeof fetchNext == "function" || typeof fetchNext == "string") ? fetchNext : null;
	}

	_fetchNext(inst, nextIdentifier, source) {
		if (this._customFetchNext) {
			const fetcher = typeof this._customFetchNext == "string" ?
				MapSetIterator.fetchers[this._customFetchNext] :
				this._customFetchNext;

			if (fetcher)
				return fetcher(inst, nextIdentifier, source);
		}

		nextIdentifier = nextIdentifier || 0;

		if (nextIdentifier >= source.length)
			return null;

		return {
			value: source[nextIdentifier],
			nextIdentifier: nextIdentifier + 1
		};
	}

	next() {
		if (this._done)
			return mkIterResultObject(undefined, true);

		const next = this._fetchNext(this, this._nextIdentifier, this.source);
		if (next === null) {
			this._nextIdentifier = undefined;
			this._done = true;
			return mkIterResultObject(undefined, true);
		}

		this._nextIdentifier = next.nextIdentifier;
		return mkIterResultObject(next.value, false);
	}

	[SYM_ITER_KEY]() {
		return this;
	}
}

MapSetIterator.fetchers = {
	// Basic ArrayIterator-like fetchers
	entries: (iter, nextIdentifier, source) => {
		if (nextIdentifier == source.length)
			return null;

		return {
			value: [nextIdentifier, source[nextIdentifier]],
			nextIdentifier: nextIdentifier + 1
		};
	},
	keys: (iter, nextIdentifier, source) => {
		if (nextIdentifier == source.length)
			return null;

		return {
			value: nextIdentifier,
			nextIdentifier: nextIdentifier + 1
		};
	},
	values: (iter, nextIdentifier, source) => {
		if (nextIdentifier == source.length)
			return null;

		return {
			value: source[nextIdentifier],
			nextIdentifier: nextIdentifier + 1
		};
	}
};

function mkIterResultObject(value, done) {
	return {
		value,
		done
	};
}
