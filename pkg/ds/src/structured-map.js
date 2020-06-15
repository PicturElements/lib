import {
	get,
	alias,
	hasOwn,
	forEach,
	isObject,
	splitPath,
	binaryIndexOf
} from "@qtxr/utils";

export default class StructuredMap extends Array {
	constructor(structure, parent = null) {
		super();
		this.lookup = {};
		this.order = 0;
		this.parent = parent;
		this.keyGetters = [];
		// Important: _direction will always be 1 (forwards) on init
		this._direction = 1;

		if (structure)
			this._init(structure);

		this._inherit(parent);
	}

	_init(structure) {
		for (let i = 0, l = structure.length; i < l; i++) {
			const partition = structure[i];
			this._resolvePartition(partition.key, partition.value, partition.children);
		}
	}

	_inherit(parent) {
		if (!parent)
			return;

		this._direction = parent._direction;
	}

	_recalculateDirection(dir) {
		const recalc = map => {
			let order = 0;

			forEach(map, part => {
				part.order = order++;
				recalc(part.children);
			}, dir == -1);

			map.order = order;
			map._direction = dir;
		};

		recalc(this);
	}

	_resolvePartition(key, value, children = []) {
		if (hasOwn(this.lookup, key)) {
			this.lookup[key].value = value;
			return this.lookup[key];
		}

		const partition = {
			key,
			value,
			order: this.order++,
			children: new StructuredMap(children, this)
		};

		if (this._direction == 1)
			this.push(partition);
		else
			this.unshift(partition);

		this.lookup[partition.key] = partition;
		return partition;
	}

	level(keyGetter) {
		switch (typeof keyGetter) {
			case "string":
				this.keyGetters.push(item => get(item, keyGetter));
				break;
			case "function":
				this.keyGetters.push(keyGetter);
				break;
			default:
				throw new TypeError("Invalid key getter");
		}

		return this;
	}

	direction(direction) {
		const dir = direction == "reverse" ? -1 : 1;

		if (dir != this._direction)
			this._recalculateDirection(dir);

		return this;
	}

	getPath(item) {
		const path = [];

		for (let i = 0, l = this.keyGetters.length; i < l; i++) {
			const key = this.keyGetters[i](item);

			if (typeof key != "string")
				throw new TypeError(`Invalid path: extractor returned a non-string key`);

			path.push(key);
		}

		return path;
	}

	add(item) {
		const path = this.getPath(item);
		let map = this;

		for (let i = 0, l = path.length; i < l; i++) {
			const key = path[i],
				partition = map._resolvePartition(key, i == l - 1 ? item : null);

			map = partition.children;
		}

		return this;
	}

	get(itemOrPath) {
		const path = isObject(itemOrPath) ?
			this.getPath(itemOrPath) :
			splitPath(itemOrPath);
		let map = this,
			partition = null;

		for (let i = 0, l = path.length; i < l; i++) {
			const key = path[i];

			if (!hasOwn(map.lookup, key))
				return null;

			partition = map.lookup[key];
			map = partition.children;
		}

		return partition && partition.value;
	}

	delete(item) {
		const path = this.getPath(item);
		let map = this;

		for (let i = 0, l = path.length; i < l; i++) {
			const key = path[i];

			if (!hasOwn(map.lookup, key))
				return false;

			map = map.lookup[key].children;
		}

		map = map.parent;

		for (let i = path.length - 1; i >= 0; i--) {
			const key = path[i],
				order = map.lookup[key].order,
				idx = binaryIndexOf(map, part => (part.order - order) * this._direction);

			map.splice(idx, 1);
			delete map.lookup[key];

			if (map.length)
				break;

			map = map.parent;
		}

		return true;
	}

	extract() {
		const out = [];

		for (let i = 0, l = this.length; i < l; i++) {
			const partition = this[i];

			out.push({
				key: partition.key,
				value: partition.value,
				children: partition.children.extract()
			});
		}

		return out;
	}

	clear() {
		this.length = 0;
		this.lookup = {};
	}
}

alias(StructuredMap.prototype, "add", "set");
