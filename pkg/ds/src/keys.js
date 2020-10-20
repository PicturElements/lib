import {
	alias,
	compileGlob
} from "@qtxr/utils";
import KeyedLinkedList from "./keyed-linked-list";

export default class Keys {
	constructor(compileConfig = {}) {
		this.partitions = {
			plaintext: new KeyedLinkedList(),
			glob: new KeyedLinkedList(),
			any: new KeyedLinkedList()
		};
		this.compileConfig = compileConfig;
		this.size = 0;
	}

	add(key, compileConfig = null) {
		if (typeof key != "string" || this.has(key))
			return this;

		let partition,
			lookupValue = key;

		if (/^\*{1,2}$/.test(key))
			partition = this.partitions.any;
		else {
			const compiled = compileGlob(key, compileConfig || this.compileConfig);

			if (compiled.isGlob) {
				partition = this.partitions.glob;
				lookupValue = compiled.regex;
			} else
				partition = this.partitions.plaintext;
		}

		partition.push(key, lookupValue);
		this.size++;

		return this;
	}

	delete(key) {
		const partitionKey = this.getPartitionKey(key);

		if (partitionKey == null)
			return false;

		const partition = this.partitions[partitionKey];
		partition.delete(key);
		this.size--;

		return true;
	}

	has(key) {
		return this.getPartitionKey(key) !== null;
	}

	getPartitionKey(key) {
		if (typeof key != "string")
			return null;

		if (this.partitions.plaintext.has(key))
			return "plaintext";
		if (this.partitions.glob.has(key))
			return "glob";
		if (this.partitions.any.has(key))
			return "any";

		return null;
	}

	forEach(key, callback) {
		if (typeof key != "string")
			return false;

		if (this.partitions.plaintext.has(key))
			callback(key, "plaintext");

		this.partitions.glob.forEach((regex, k) => {
			if (regex.test(key))
				callback(k, "glob");
		});

		this.partitions.any.forEach((_, key) => callback(key, "any"));

		return true;
	}
}

alias(Keys.prototype, "add", "set");
