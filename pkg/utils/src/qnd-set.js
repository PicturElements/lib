import { SYM_ITER_KEY } from "./internal/constants";
import { isArrayLike } from "./is";
import forEach from "./for-each";

// Quick-and-dirty set
// Will try to use performant Set, else will default to a quick-and-dirty
// array-based implementation. Note that this implementation is meant to offer
// only the basic API with suboptimal performance in exchange
// for terseness. Use the Set polyfill for optimal performance and browser compatibility
// Note that this implementation also doesn't offer support for reliable NaN mapping
const QNDSet = typeof Set == "undefined" ? class {
	constructor(arr) {
		this._set = [];

		if (isArrayLike(arr))
			forEach(arr, v => this.set(v));
	}

	has(item, getIndex) {
		const idx = this._set.indexOf(item);
		return getIndex ? idx : idx > -1;
	}

	add(item) {
		if (!this.has(item))
			this._set.push(item);
		return this;
	}

	delete(item) {
		const idx = this.has(item, true);
		if (idx > -1)
			this._set.splice(idx, 1);
		return idx > -1;
	}

	[SYM_ITER_KEY]() {
		const set = this._set;

		return {
			index: 0,
			next() {
				return {
					value: set[this.index++],
					done: this.index > set.length
				};
			}
		};
	}
} : Set;

export default QNDSet;
