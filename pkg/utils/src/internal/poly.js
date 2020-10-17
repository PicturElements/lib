import { SYM_ITER_KEY } from "../data/constants";

// Will try to use performant native classes/polyfills, else will default to a basic
// array-based implementation. Note that this implementation is meant to offer
// only the basic API with suboptimal performance and edge case support in exchange
// for terseness. Use a proper polyfill for optimal performance and browser compatibility
// These concerns are also why these classes are not exposed directly in public builds

const NULL = Object.freeze({ NULL: true });
const nIsNaN = v => typeof v == "number" && isNaN(v);

class PolyBase {
	constructor() {
		this._keys = [];
		this._values = [];
		this.size = 0;
	}

	has(item, getIndex) {
		let idx = -1;

		if (nIsNaN(item)) {
			for (let i = 0, l = this._keys.length; i < l; i++) {
				if (nIsNaN(this._keys[i])) {
					idx = i;
					break;
				}
			}
		} else
			idx = this._keys.indexOf(item);

		return getIndex ?
			idx :
			idx > -1;
	}

	set(key, value) {
		const idx = this.has(key, true);

		if (idx == -1) {
			this._keys.push(key);
			this._values.push(value);
			this.size++;
		} else
			this._values[idx] = value;

		return this;
	}

	getAtIdx(idx, type) {
		if (idx < 0 || idx >= this._keys.length)
			return null;

		switch (type) {
			case "kv":
				return [this._keys[idx], this._values[idx]];

			case "key":
				return this._keys[idx];

			case "value":
			default:
				return this._values[idx];
		}
	}

	delete(key) {
		const idx = this.has(key, true);

		if (idx > -1) {
			this._keys[idx] = NULL;
			this._values[idx] = NULL;
			this.size--;
			return true;
		}

		return false;
	}

	getIterator(type) {
		let index = -1;
		const keys = this._keys;

		const iter = {
			next: _ => {
				while (++index < keys.length) {
					if (keys[index] == NULL)
						continue;

					return {
						value: this.getAtIdx(index, type),
						done: false
					};
				}

				return {
					value: undefined,
					done: true
				};
			},
			[SYM_ITER_KEY]: _ => iter
		};

		return iter;
	}

	forEach(callback) {
		for (let i = 0, l = this._keys.length; i < l; i++) {
			if (this._keys[i] != NULL)
				callback(this._values[i], this._keys[i], this);
		}
	}

	entries() {
		return this.getIterator("kv");
	}

	keys() {
		return this.getIterator("key");
	}

	values() {
		return this.getIterator("value");
	}
}

const PolyMap = typeof Map != "undefined" ?
	class PolyMap extends PolyBase {
		constructor(iterable) {
			super();
			if (Array.isArray(iterable))
				iterable.forEach(v => this.set(...v));
		}

		get(key) {
			return this.getAtIdx(
				this.has(key, true)
			);
		}
	} :
	Map;

PolyMap.prototype.add = PolyMap.prototype.set;
PolyMap.prototype[SYM_ITER_KEY] = PolyMap.prototype.entries;

const PolySet = typeof Set != "undefined" ?
	class PolySet extends PolyBase {
		constructor(iterable) {
			super();
			if (Array.isArray(iterable))
				iterable.forEach(v => this.add(v));
		}

		add(key) {
			return super.set(key, key);
		}
	} :
	Set;

PolySet.prototype.set = PolySet.prototype.add;
PolySet.prototype[SYM_ITER_KEY] = PolySet.prototype.values;

export {
	PolyMap,
	PolySet
};
