import {
	alias,
	isObj,
	hasOwn,
	isObject,
	setSymbol,
	isIterable
} from "@qtxr/utils";
import { SYM_ITER_KEY } from "@qtxr/utils/internal";
import KeyedLinkedList from "./keyed-linked-list";

let idCounter = 0;

export default class MapSetBase {
	constructor(iterable) {
		if (iterable != null && !isIterable(iterable))
			throw new TypeError("Iterator value is not iterable");

		this.maps = {
			strSym: {},
			number: {},
			bigint: {},
			boolUndefNull: {},
			object: Object.create(null),
			inex: {
				array: [],
				object: [],
				instance: []
			}
		};

		this.insertions = new KeyedLinkedList();
		this.order = 0;
		this.size = 0;
	}

	// Complexity: O(1)
	add(key, value) {
		const insertion = getInsertion(this, key);
		
		if (insertion) {
			insertion[1] = value;
			return this;
		}

		const kv = [key, value, this.order++];

		switch (typeof key) {
			case "string":
			case "symbol":
				this.maps.strSym[key] = kv;
				break;

			case "number":
				this.maps.number[key] = kv;
				break;

			case "bigint":
				this.maps.bigint[key] = kv;
				break;

			case "undefined":
			case "boolean":
				this.maps.boolUndefNull[key] = kv;
				break;

			default: {
				if (key == null) {
					this.maps.boolUndefNull.null = kv;
					break;
				}
				
				if (hasOwn(key, this.key)) {
					this.maps.object[key[this.key]] = kv;
					break;
				}

				if (Object.isExtensible(key)) {
					const id = idCounter++;
					setSymbol(key, this.key, id);
					this.maps.object[id] = kv;
				} else
					this.maps.inex[getInexMapName(key)].push(kv);
			}
		}

		if (!insertion) {
			this.size++;
			this.insertions.push(kv[2], kv);
		}

		return this;
	}

	// Complexity: O(1)
	get(key) {
		const insertion = getInsertion(this, key);
		if (!insertion)
			return;

		return insertion[1];
	}

	// Complexity: O(1)
	delete(key) {
		const map = getMapName(this, key);
		if (!map) {
			if (isObj(key) && !Object.isExtensible(key)) {
				const data = getInexInsertion(this, key);
				if (!data)
					return false;

				this.insertions.delete(data.insertion[2]);
				this.maps.inex[data.name].splice(data.index, 1);
				this.size--;
				return true;
			}

			return false;
		}

		this.size--;

		if (map == "object") {
			this.insertions.delete(this.maps.object[key[this.key]][2]);
			delete this.maps.object[key[this.key]];
			delete key[this.key];
			return true;
		}

		this.insertions.delete(this.maps[map][key][2]);
		return delete this.maps[map][key];
	}

	// Complexity: O(n) to clear all object references
	clear() {
		const ob = this.maps.object;
		for (let k in ob)
			delete ob[k][this.key];

		this.maps = {
			strSym: {},
			number: {},
			bigint: {},
			boolUndefNull: {},
			object: Object.create(null),
			inex: {
				array: [],
				object: [],
				instance: []
			}
		};

		this.insertions.clear();
		this.size = 0;
	}

	// Complexity: O(1)
	has(key) {
		const has = Boolean(getMapName(this, key));
		if (has)
			return true;
		
		if (isObj(key) && !Object.isExtensible(key))
			return Boolean(getInexInsertion(this, key));

		return has;
	}

	forEach(callback, thisArg) {
		this.insertions.forEach(item => {
			callback.call(thisArg, item[1], item[0], this);
		});
	}

	keys() {
		return this.insertions.getIterator("kv-key");
	}

	values() {
		return this.insertions.getIterator("kv-value");
	}

	entries() {
		return this.insertions.getIterator("kv-entry");
	}
}

alias(MapSetBase.prototype, {
	entries: SYM_ITER_KEY,
	add: "set"
});

function getInsertion(map, key) {
	const mapName = getMapName(map, key);
	if (!mapName) {
		if (isObj(key) && !Object.isExtensible(key)) {
			const data = getInexInsertion(map, key);
			return data && data.insertion;
		}

		return null;
	}

	if (mapName == "object")
		return map.maps[mapName][key[map.key]];

	return map.maps[mapName][key];
}

function getMapName(map, key) {
	const maps = map.maps;

	switch (typeof key) {
		case "string":
		case "symbol":
			return hasOwn(maps.strSym, key) ? "strSym" : null;

		case "number":
			return hasOwn(maps.number, key) ? "number" : null;

		case "bigint":
			return hasOwn(maps.bigint, key) ? "bigint" : null;

		case "undefined":
		case "boolean":
			return hasOwn(maps.boolUndefNull, key) ? "boolUndefNull" : null;

		default:
			if (key == null)
				return hasOwn(maps.boolUndefNull, key) ? "boolUndefNull" : null;

			return key[map.key] in maps.object ? "object" : null;
	}
}

function getInexMapName(key) {
	if (Array.isArray(key))
		return "array";

	if (isObject(key))
		return "object";

	return "instance";
}

function getInexInsertion(map, key) {
	const name = getInexMapName(key),
		inex = map.maps.inex[name];

	for (let i = 0, l = inex.length; i < l; i++) {
		if (inex[i][0] == key) {
			return {
				name,
				insertion: inex[i],
				index: i
			};
		}
	}

	return null;
}
