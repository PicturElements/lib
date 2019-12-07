import {
	compileGlob,
	binarySearch
} from "@qtxr/utils";

export default class Keys {
	constructor() {
		this.partitions = {
			plaintext: {
				keys: [],
				length: 0,
				lookup: {}
			},
			glob: {
				keys: [],
				length: 0,
				lookup: {}
			},
			any: {
				keys: [],
				length: 0,
				lookup: {}
			}
		};
		this.length = 0;
	}

	add(key) {
		if (typeof key != "string" || this.has(key))
			return this;

		let partition,
			lookupValue = key;

		if (isAny(key))
			partition = this.partitions.any;
		else {
			const compiled = compileGlob(key);

			if (compiled.isGlob) {
				partition = this.partitions.glob;
				lookupValue = compiled.regex;
			} else
				partition = this.partitions.plaintext;
		}

		const nextIdx = binarySearch(partition.keys, key) + 1;
		partition.keys.splice(nextIdx, 0, key);
		partition.lookup[key] = lookupValue;
		
		partition.length++;
		this.length++;

		return this;
	}

	delete(key) {
		const partitionKey = this.getPartitionKey(key);

		if (partitionKey == null)
			return this;

		const partition = this.partitions[partitionKey],
			keyIdx = binarySearch(partition.keys, key);

		delete partition.lookup[key];
		if (keyIdx > -1)
			partition.keys.splice(keyIdx, 1);

		partition.length--;
		this.length--;

		return this;
	}

	has(key) {
		return this.getPartitionKey(key) !== null;
	}

	getPartitionKey(key) {
		if (typeof key != "string")
			return null;

		// Super basic loop unrolling
		if (this.partitions.plaintext.lookup.hasOwnProperty(key))
			return "plaintext";
		if (this.partitions.glob.lookup.hasOwnProperty(key))
			return "glob";
		if (this.partitions.any.lookup.hasOwnProperty(key))
			return "any";

		return null;
	}

	forEach(key, callback) {
		if (typeof key != "string")
			return false;

		if (this.partitions.plaintext.lookup.hasOwnProperty(key))
			callback(key, "plaintext");
		
		const globs = this.partitions.glob.keys;
		for (let i = 0, l = globs.length; i < l; i++) {
			const regex = this.partitions.glob.lookup[globs[i]];

			if (regex.test(key))
				callback(globs[i], "glob");
		}

		const any = this.partitions.any.keys;
		for (let i = 0, l = any.length; i < l; i++)
			callback(any[i], "any");

		return true;
	}
}

const anyRegex = /^(?:\*)$/;

function isAny(key) {
	return anyRegex.test(key);
}