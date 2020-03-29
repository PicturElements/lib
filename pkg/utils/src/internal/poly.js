import { SYM_ITER_KEY } from "./constants";
import forEach from "../for-each";

// Quick-and-dirty maps and sets
// Will try to use performant native classes/polyfills, else will default to a quick-and-dirty
// array-based implementation. Note that this implementation is meant to offer
// only the basic API with suboptimal performance and edge case support in exchange
// for terseness. Use a proper polyfill for optimal performance and browser compatibility

const NULL = Object.freeze({ NULL: true });

class QNDBase {
	constructor() {
		this.keys = [];
		this.values = [];
		this.size = 0;
	}

	has(item, getIndex) {
		let idx = -1;

		if (isNaN(item)) {
			for (let i = 0, l = this.keys.length; i < l; i++) {
				if (isNaN(this.keys[i])) {
					idx = i;
					break;
				}
			}
		} else
			idx = this.keys.indexOf(item);

		return getIndex ?
			idx :
			idx > -1;
	}

	set(key, value) {
		const idx = this.has(key, true);

		if (idx == -1) {
			this.keys.push(key);
			this.values.push(value);
			this.size++;
		} else
			this.keys[idx] = key;

		return this;
	}

	getAtIdx(idx, type) {
		if (idx < 0 || idx >= this.keys.length)
			return null;

		switch (type) {
			case "kv":
				return [this.keys[idx], this.values[idx]];

			case "key":
				return this.keys[idx];

			case "value":
			default:
				return this.values[idx];
		}
	}

	delete(key) {
		const idx = this.has(key, true);

		if (idx > -1) {
			this.keys[idx] = NULL;
			this.values[idx] = NULL;
			this.size--;
			return true;
		}

		return false;
	}

	getIterator(type) {
		let index = -1;
		const keys = this.keys;

		return {
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
			}
		};
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

const QNDMap = typeof Map == "undefined" ?
	class QNDMap extends QNDBase {
		constructor(iterable) {
			super();
			forEach(iterable, v => this.set(...v));
		}

		get(key) {
			return this.getAtIdx(
				this.has(key, true)
			);
		}
	} :
	Map;

QNDMap.prototype.add = QNDMap.prototype.set;
QNDMap.prototype[SYM_ITER_KEY] = QNDMap.prototype.entries;

const QNDSet = typeof Set == "undefined" ?
	class QNDSet extends QNDBase {
		constructor(iterable) {
			super();
			forEach(iterable, v => this.add(v));
		}

		add(key) {
			return super.set(key, key);
		}
	} :
	Set;

QNDSet.prototype.set = QNDSet.prototype.add;
QNDSet.prototype[SYM_ITER_KEY] = QNDSet.prototype.values;

export {
	QNDMap,
	QNDSet
};
