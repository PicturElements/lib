import {
	hasOwn,
	getHash,
	typeHash
} from "./utils";

export default class Heap extends Array {
	constructor() {
		super();
		this.hashResolver = null;
		this.type = "min";
		this.hashLookup = {};
		this.size = 0;
	}

	has(val) {
		const typedHash = typeHash(getHash(this, val));
		return hasOwn(this.hashLookup, typedHash);
	}

	insert(val) {
		const hash = getHash(this, val),
			typedHash = typeHash(hash),
			isMinHeap = this.type == "min";
		let idx = this.length,
			parIdx = parent(idx);

		this.push(val);
		this.size++;

		while (idx > 0 && ((getHash(this, this[parIdx]) < this[idx]) ^ isMinHeap)) {
			swap(this, idx, parIdx);
			idx = parIdx;
			parIdx = parent(idx);
		}

		this.hashLookup[typedHash] = (this.hashLookup[typedHash] || 0) + 1;
		return this;
	}

	add(val) {
		return this.insert(val);
	}
	
	extractRoot() {
		return this.extractIdx(0);
	}

	extract(val) {
		if (!this.length)
			return null;
		
		const hash = getHash(this, val),
			typedHash = typeHash(hash);

		if (this.length == 1) {
			if (getHash(this, this[0]) == hash)
				return this.extractIdx(0, typedHash);

			return null;
		}
		
		
	}

	delete(val) {
		return this.extract(val);
	}

	extractIdx(idx = 0, typedHash = null) {
		if (!this.length || idx >= this.length)
			return null;

		typedHash = typedHash || typeHash(getHash(this, this[idx]));

		if (!hasOwn(this.hashLookup, typedHash))
			return null;

		this.hashLookup[typedHash]--;
		if (!this.hashLookup[typedHash])
			delete this.hashLookup[typedHash];

		const node = this[idx];
		this[idx] = this[this.length - 1];
		this.length--;
		this.size--;

		if (this.length)
			heapify(this, idx);

		return node;
	}

	peek() {
		return this.length ? this[0] : null;
	}
}

function heapify(heap, idx) {
	const l = left(idx),
		r = right(idx),
		isMinHeap = heap.type == "min";
	
	if (l < heap.length && ((getHash(heap, heap[l]) < getHash(heap, idx)) ^ isMinHeap)) {
		swap(heap, l, idx);
		heapify(heap, l);
	}

	if (r < heap.length && ((getHash(heap, heap[r]) < getHash(heap, idx)) ^ isMinHeap)) {
		swap(heap, r, idx);
		heapify(heap, r);
	}
}

function swap(heap, idx, idx2) {
	const tmp = heap[idx];
	heap[idx] = heap[idx2];
	heap[idx2] = tmp;
}

function parent(idx) {
	return ~~((idx - 1) / 2);
}

function left(idx) {
	return 2 * idx + 1;
}

function right(idx) {
	return 2 * idx + 2;
}
