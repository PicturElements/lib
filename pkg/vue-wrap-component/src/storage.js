import { hasOwn } from "@qtxr/utils";
import { KeyedLinkedList } from "@qtxr/ds";

export default class Storage extends KeyedLinkedList {
	constructor(parent = null) {
		super();
		this.parent = parent;
		this.partitions = {};
	}

	partition(key) {
		if (typeof key != "string") {
			console.warn("Cannot create/retrieve partition: key is not a string");
			return null;
		}

		if (hasOwn(this.partitions, key))
			return this.partitions[key];

		this.partitions[key] = new Storage(this);
		return this.partitions[key];
	}

	extract(deep = false) {
		const out = super.extract();

		if (!deep)
			return out;

		for (const k in this.partitions) {
			if (hasOwn(this.partitions, k))
				out[k] = this.partitions[k].extract(deep);
		}

		return out;
	}
}
