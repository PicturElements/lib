import {
	resolveArgs,
	findClosest,
	binarySearch
} from "@qtxr/utils";
import { getHash } from "./utils";

// A partitioned binary array (PBA) is a specialized data structure that
// employs binary search to insert/find/delete items in logarithmic time.
// While it's possible to do this with a shallow array, a PBA is a nested data structure.
// This is because array operations are linear, so frequent additions/deletions are
// quite expensive. A PBA amortizes time by ordering data into fixed length partitons that act
// as sortable items in the root array, while containing sorted data themselves.
//
// Search action:
// 1.	A binary search is done on partitions in the root level array. This is done by comparing
// 		the first elements of each partition to the reference value. The index of the partition
//		with the head value closest to the refrence value is saved.
// 2.	If the index ends up being out of bounds, false is returned
// 3.	Else, a second binary search is done on the partition's elements. The two binary searches
//		are not significantly slower than a single on a shallow array
// Addition action:
// 1.	A binary search is done on partitions in the root level array. This is done by comparing
// 		the first elements of each partition. It returns the index of the partition whose head has
//		a value closest to the inserted value.
// 2.	If a the partition is full, a new partition is spliced into the root array with the value
//		as its only element.
// 3.	If the partition is not full, a second binary search is run over its elements whereupon the
//		value is spliced into the partition. While this is an expensive operation, the size of the array
//		is always limited to reduce time. The same applies to the root level, where the length can be
//		reduced by as much as the fixed length of each partition.
// Deletion action:
// 1.	A binary search is done on all partitions and their elements.
// 2.	If no value is found matching the reference value, the operation is halted and false is returned
// 3.	Else, the value is spliced from the found partition.
// 4.	If this operation leaves the partition empty, the partition is also spliced from the root array
//
// This data structure performs optimally with:
// Sequential input

const pbaConstructorParams = [
	{ name: "hash", type: "string|function", default: null },
	{ name: "comparator", type: "function", default: null },
	{ name: "partitionSize", type: "number", default: 600 }
];

export default class PartitionedBinaryArray extends Array {
	constructor(...args) {
		const {
			hash,
			comparator,
			partitionSize
		} = resolveArgs(args, pbaConstructorParams, "allowSingleSource");

		super();
		this.hashResolver = hash;
		this.comparator = comparator;
		this.partitionSize = partitionSize;
		this.size = 0;
	}

	has(val) {
		const hash = getHash(this, val),
			partition = this[rootBinarySearch(this, hash)];

		if (!partition)
			return false;

		return partitionBinarySearch(this, partition, hash).exact;
	}

	add(val) {
		const hash = getHash(this, val),
			idx = rootBinarySearch(this, hash),
			partition = this[idx];

		if (idx == -1)
			this.splice(0, 0, [val]);
		else {
			const result = partitionBinarySearch(this, partition, hash),
				spliceIdx = result.index;

			if (partition.length >= this.partitionSize) {
				if (spliceIdx == partition.length - 1)
					this.splice(idx + 1, 0, [val]);
				else {
					this.splice(
						idx, 1,
						partition.slice(0, spliceIdx + 1),
						[val],
						partition.slice(spliceIdx + 1)
					);
				}
			} else if (spliceIdx == partition.length - 1)
				partition.push(val);
			else
				partition.splice(spliceIdx + 1, 0, val);
		}

		this.size++;
		return this;
	}

	delete(val) {
		const hash = getHash(this, val),
			idx = rootBinarySearch(this, hash),
			partition = this[idx];

		if (idx == -1)
			return false;
		else {
			const result = partitionBinarySearch(this, partition, hash);
			if (!result.exact)
				return false;

			if (partition.length == 1)
				this.splice(idx, 1);
			else
				partition.splice(result.index, 1);
		}

		this.size--;
		return true;
	}

	clear() {
		this.length = 0;
		this.size = 0;
	}

	forEach(callback) {
		if (typeof callback != "function")
			return false;

		let idx = 0;

		for (let i = 0, l = this.length; i < l; i++) {
			const partition = this[i];

			for (let j = 0, l2 = partition.length; j < l2; j++)
				callback(partition[j], idx++, this);
		}

		return true;
	}
}

function rootBinarySearch(pba, hash) {
	if (!pba.length)
		return -1;

	const comparator = typeof pba.comparator == "function" ?
		typeof pba.comparator :
		null;

	return binarySearch(pba, v => {
		const h = getHash(pba, v[0]);

		if (comparator)
			return comparator(h, hash);

		if (h == hash)
			return 0;

		if (h < hash)
			return -1;

		return 1;
	});
}

function partitionBinarySearch(pba, partition, hash) {
	const comparator = typeof pba.comparator == "function" ?
		typeof pba.comparator :
		null;

	return findClosest(partition, v => {
		const h = getHash(pba, v);

		if (comparator)
			return comparator(h, hash);

		if (h == hash)
			return 0;

		if (h < hash)
			return -1;

		return 1;
	}, "lower");
}