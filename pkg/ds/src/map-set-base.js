import {
	findClosest,
	isIterable,
	setSymbol
} from "@qtxr/utils";
import { SYM_ITER_KEY } from "@qtxr/utils/internal";
import MapSetIterator from "./map-set-iterator";

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

		this.insertionOrder = [];
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
			this.insertionOrder.push(kv);
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

	// Complexity: O(log n) for object keys, O(1) for primitive keys
	delete(key) {
		const map = getMapName(this, key);
		if (!map)
			return false;

		this.size--;

		if (map == "object") {
			deleteFromInsertion(this.insertionOrder, this.maps[map][key[this.key]]);
			delete this.maps[map][key[this.key]];
			return delete key[this.key];
		}

		deleteFromInsertion(this.insertionOrder, this.maps[map][key]);
		return delete this.maps[map][key];
	}

	// Complexity: worst case O(n) to clear all object references
	clear() {
		this.maps.strSym = {};
		this.maps.number = {};
		this.maps.boolUndefNull = {};

		const ob = this.maps.object;
		for (let k in ob)
			delete ob[k][this.key];
		this.maps.object = Object.create(null);

		this.insertionOrder = [];
		this.size = 0;
	}

	// Complexity: O(1)
	has(key) {
		return !!getMapName(this, key);
	}

	keys() {
		return new MapSetIterator(
			this.insertionOrder,
			getFirstInsertionId(this.insertionOrder),
			iterator => nextIterStepSingular(iterator, 0)
		);
	}

	entries() {
		return new MapSetIterator(
			this.insertionOrder,
			getFirstInsertionId(this.insertionOrder),
			iterator => nextIterStep(iterator, 0, 2)
		);
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

function deleteFromInsertion(list, item) {
	const itemIdx = item[2],
		match = findClosest(list, itm => itm[2] - itemIdx);

	if (match.exact)
		list.splice(match.index, 1);
}

function getFirstInsertionId(insertionOrder) {
	const first = insertionOrder[0];
	if (!first)
		return 0;

	return first[2];
}

function getNextInsertion(iterator) {
	const nextIdentifier = iterator._nextIdentifier;

	return findClosest(
		iterator.source,
		insertion => insertion[2] - nextIdentifier,
		{
			upper: true,
			hintIndex: iterator.hint
		}
	);
}

function nextIterStep(iterator, sliceStart, sliceEnd) {
	const next = getNextInsertion(iterator);

	if (!next.found)
		return null;

	iterator.hint = next.index + 1;

	return {
		value: next.item.slice(sliceStart, sliceEnd),
		nextIdentifier: next.item[2] + 1
	};
}

function nextIterStepSingular(iterator, index) {
	const next = getNextInsertion(iterator);

	if (!next.found)
		return null;

	iterator.hint = next.index + 1;

	return {
		value: next.item[index],
		nextIdentifier: next.item[2] + 1
	};
}

export {
	getFirstInsertionId,
	nextIterStep,
	nextIterStepSingular
};
