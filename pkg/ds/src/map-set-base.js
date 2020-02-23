import {
	isIterable,
	setSymbol
} from "@qtxr/utils";
import { SYM_ITER_KEY } from "@qtxr/utils/internal";
import KeyedLinkedList from "./keyed-linked-list";

let idCounter = 0;
const symbolIsSupported = typeof Symbol != "undefined";

export default class MapSetBase {
	constructor(iterable) {
		if (iterable != null && !isIterable(iterable))
			throw new TypeError("Iterator value is not iterable");

		this.maps = {
			strSym: {},
			number: {},
			bigint: {},
			boolUndefNull: {},
			object: Object.create(null)
		};

		this.insertions = new KeyedLinkedList();
		this.order = 0;
		this.size = 0;
	}

	// Complexity: O(1)
	add(key, value) {
		const insertion = getInsertion(this, key);
		let kv = insertion;

		if (insertion)
			kv[1] = value;
		else
			kv = [key, value, this.order++];

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

			default:
				if (key == null) {
					this.maps.boolUndefNull.null = kv;
					break;
				}
				
				if (key.hasOwnProperty(this.key)) {
					this.maps.object[key[this.key]] = kv;
					break;
				}
				
				const id = idCounter++;

				if (symbolIsSupported)
					key[this.key] = id;
				else
					setSymbol(key, this.key, id);
				
				this.maps.object[id] = kv;
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
		if (!map)
			return false;

		this.size--;

		if (map == "object") {
			this.insertions.delete(this.maps.object[key[this.key]][2]);
			delete this.maps.object[key[this.key]];
			return delete key[this.key];
		}

		this.insertions.delete(this.maps[map][key][2]);
		return delete this.maps[map][key];
	}

	// Complexity: O(n) to clear all object references
	clear() {
		this.maps.strSym = {};
		this.maps.number = {};
		this.maps.boolUndefNull = {};

		const ob = this.maps.object;
		for (let k in ob)
			delete ob[k][this.key];
		this.maps.object = Object.create(null);

		this.insertions.clear();
		this.size = 0;
	}

	// Complexity: O(1)
	has(key) {
		return Boolean(getMapName(this, key));
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

MapSetBase.prototype[SYM_ITER_KEY] = MapSetBase.prototype.entries;

function getInsertion(map, key) {
	const mapName = getMapName(map, key);
	if (!mapName)
		return;

	if (mapName == "object")
		return map.maps[mapName][key[map.key]];

	return map.maps[mapName][key];
}

function getMapName(map, key) {
	const maps = map.maps;

	switch (typeof key) {
		case "string":
		case "symbol":
			return maps.strSym.hasOwnProperty(key) ? "strSym" : null;

		case "number":
			return maps.number.hasOwnProperty(key) ? "number" : null;

		case "bigint":
			return maps.bigint.hasOwnProperty(key) ? "bigint" : null;

		case "undefined":
		case "boolean":
			return maps.boolUndefNull.hasOwnProperty(key) ? "boolUndefNull" : null;

		default:
			if (key == null)
				return maps.boolUndefNull.hasOwnProperty(key) ? "boolUndefNull" : null;
			return key[map.key] in maps.object ? "object" : null;
	}
}
