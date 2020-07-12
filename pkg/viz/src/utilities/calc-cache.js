import {
	get,
	hasOwn
} from "@qtxr/utils";

// Caching manager. Allows you to cache calculated data if it's ever needed again.
// Useful when you need similar data across different areas of your program that
// may execute at different times or in areas of code that are clearly separated.
export default class CalcCache {
	constructor() {
		this.cache = {};
	}

	registerCachePartition(partition) {
		if (hasOwn(this.cache, partition))
			throw new Error(`Cache partition '${partition}' is already in use.`);
		if (!partition)
			throw new Error("Cache partition must have a valid name.");
		this.cache[partition] = {};
	}

	clearCache(partition) {
		if (partition) {
			if (hasOwn(this.cache, partition))
				this.cache[partition] = {};
		} else
			this.cache = {};
	}

	request(partition, accessor, fallback, callback, terminateOnUndefined) {
		if (!hasOwn(this.cache, partition))
			throw new Error("Partition does not exist in cache.");

		let item = get(this.cache[partition], accessor),
			ref = get(this.cache[partition], accessor, null, {
				autoBuild: true,
				context: true
			});

		item = item === undefined ? fallback() : item;
		ref.context[ref.key] = item;

		if (terminateOnUndefined) {
			if (item !== undefined)
				return callback(item);
		} else
			return callback(item);

		return null;
	}
}
