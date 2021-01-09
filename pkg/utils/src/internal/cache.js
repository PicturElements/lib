import { hasOwn } from "./duplicates";
import {
	upHeap,
	addHeapNode
} from "../binary-heap";

// Simple LFU cache to avoid memory leaks from uncontrolled caching
// Nodes are inserted into a binary heap until it reaches a predetermined size (maxSize)
// Then, a number (buffer) of least frequently used nodes are discarded and the process repeats
// By the nature of the implementation, least frequently used nodes are
// added and removed broadly according to LIFO
class LFUCache {
	constructor(maxSize = 1e3, buffer = 1e2) {
		this.heap = [];
		this.map = {};
		this.maxSize = Math.max(maxSize, 10);
		this.buffer = Math.max(Math.min(buffer, maxSize - 1), 1);
	}

	set(key, value) {
		if (this.has(key)) {
			this.map[key].value = value;
			return this;
		}

		if (this.heap.length == this.maxSize - 2) {
			for (let i = this.heap.length - this.buffer, l = this.heap.length; i < l; i++) {
				const node = this.heap[i];
				delete this.map[node.key];
			}

			this.heap.length -= this.buffer;
		}

		// Since all nodes that are freshly inserted haven't been used,
		// they always satisfy the max heap property, removing the need
		// to up-heap in the first step
		this.map[key] = addHeapNode(this.heap, key, value)("uses", 0);
		return this;
	}

	get(key) {
		if (!this.has(key))
			return null;

		const node = this.map[key];

		node.uses++;
		upHeap(this.heap, node, "uses");

		return node.value;
	}

	has(key) {
		return hasOwn(this.map, key);
	}
}

export {
	LFUCache
};
