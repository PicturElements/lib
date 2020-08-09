import {
	alias,
	forEach,
	isPrimitive,
	isArrayLike
} from "@qtxr/utils";
import { SYM_ITER_KEY } from "@qtxr/utils/internal";
import StatelessIterator from "./internal/stateless-iterator";
import { typeHash } from "./internal/utils";

export default class KeyedLinkedList {
	constructor(iterable, enforceUnique = true) {
		if (typeof iterable == "boolean") {
			enforceUnique = iterable;
			iterable = null;
		}

		this.head = null;
		this.tail = null;
		this.size = 0;
		this.enforceUnique = enforceUnique;
		this.map = Object.create(null);

		forEach(iterable, entry => {
			if (!isArrayLike(entry))
				throw new TypeError("Iterator value is not an entry object");

			this.push(entry[0], entry[1]);
		});
	}

	put(key, value, reference, refPos = "previous") {
		if (!assertValidKey(key))
			return null;

		reference = reference || null;
		const typedKey = typeHash(key);
		let previous = null,
			next = null;

		if (reference && typeof reference != "string") {
			if (reference.owner != this) {
				console.warn("Cannot put: the provided reference node is not valid or does not belong to this KeyedLinkedList");
				return null;
			}

			if (!reference.linked) {
				console.warn("Cannot put: the provided reference node is no longer connected to this KeyedLinkedList");
				return null;
			}

			if (refPos == "next") {
				next = reference;
				previous = reference.previous;
			} else {
				next = reference.next;
				previous = reference;
			}
		} else if (reference == "head")
			next = this.head;
		else
			previous = this.tail;

		const node = (this.enforceUnique && this.pluck(this.map[typedKey])) || {
			key,
			typedKey,
			owner: this
		};

		node.value = value;
		node.next = next;
		node.previous = previous;
		node.linked = true;

		if (!previous && !next)
			node.id = 0;
		else if (!next)
			node.id = previous.id + 1;
		else if (!previous)
			node.id = next.id - 1;
		else {
			const prevId = previous.id,
				nextId = next.id,
				id = (prevId + nextId) / 2;

			// Catch floating point rounding errors and patch by spacing IDs further apart
			// This happens appoximately once every 50 insertions (assumes the worst case
			// scenario where nodes are spliced at the same location repeatedly)
			if (id <= prevId || id >= nextId) {
				let n = next;
				node.id = ~~prevId + 1;
				next.id = node.id + 1;

				while (n && n.next) {
					n.next.id = n.id + 1;
					n = n.next;
				}
				console.log("uh");
			} else
				node.id = id;
		}

		if (previous)
			previous.next = node;
		else
			this.head = node;

		if (next)
			next.previous = node;
		else
			this.tail = node;

		if (this.enforceUnique)
			this.map[typedKey] = node;
		else if (!this.map[typedKey])
			this.map[typedKey] = [node];
		else
			this.map[typedKey].push(node);

		this.size++;
		return node;
	}

	pluck(node, noDelete = false) {
		if (!node)
			return null;

		if (node.owner != this) {
			console.warn("Cannot pluck: the provided reference node is not valid or does not belong to this KeyedLinkedList");
			return null;
		}

		if (!node.linked) {
			console.warn("Cannot pluck: the provided node is no longer connected to this KeyedLinkedList");
			return null;
		}

		if (node.next)
			node.next.previous = node.previous;
		else
			this.tail = node.previous;

		if (node.previous)
			node.previous.next = node.next;
		else
			this.head = node.next;

		if (!noDelete) {
			if (this.enforceUnique)
				delete this.map[node.typedKey];
			else {
				const partition = this.map[node.typedKey];

				if (partition.length == 1)
					delete this.map[node.typedKey];
				else
					partition.splice(partition.indexOf(node), 1);
			}
		}

		node.linked = false;
		node.previous = null;
		node.next = null;
		this.size--;
		return node;
	}

	push(key, value) {
		this.put(key, value, "tail");
		return this;
	}

	pop() {
		return this.pluck(this.tail);
	}

	unshift(key, value) {
		this.put(key, value, "head");
		return this;
	}

	shift() {
		return this.pluck(this.head);
	}

	has(key) {
		return assertValidKey(key) && Boolean(this.map[typeHash(key)]);
	}

	get(key, raw = false) {
		const nullValue = this.enforceUnique ? null : [];

		if (!assertValidKey(key))
			return nullValue;

		const item = this.map[typeHash(key)];
		if (!item)
			return nullValue;

		if (raw)
			return item;

		if (this.enforceUnique)
			return item.value;

		const out = [];

		for (let i = 0, l = item.length; i < l; i++)
			out.push(item[i].value);

		return out;
	}

	item(key) {
		const nullValue = this.enforceUnique ? null : [];

		if (!assertValidKey(key))
			return nullValue;

		return this.map[typeHash(key)] || nullValue;
	}

	delete(key) {
		if (!this.has(key))
			return false;

		const typedKey = typeHash(key);

		if (this.enforceUnique)
			this.pluck(this.map[typedKey], true);
		else {
			const partition = this.map[typedKey];

			for (let i = 0, l = partition.length; i < l; i++)
				this.pluck(partition[i], true);
		}

		delete this.map[typedKey];
		return true;
	}

	clear() {
		this.head = null;
		this.tail = null;
		this.size = 0;
		this.map = Object.create(null);
	}

	forEach(callback, reverse = false) {
		if (typeof callback != "function")
			return false;

		let node = reverse ? this.tail : this.head,
			idx = reverse ? this.size : 0;

		if (reverse) {
			while (node) {
				callback(node.value, node.key, this, node, --idx);
				node = node.previous;
			}
		} else {
			while (node) {
				callback(node.value, node.key, this, node, idx++);
				node = node.next;
			}
		}

		return true;
	}

	find(callback) {
		if (typeof callback != "function")
			return null;

		let node = this.head,
			idx = 0;

		while (node) {
			if (callback(node.value, node.key, this, node, idx++))
				return node;

			node = node.next;
		}

		return null;
	}

	extract() {
		const out = {};
		this.forEach((v, k) => out[k] = v);
		return out;
	}

	getIterator(dispatcher) {
		return mkIterator(this, dispatcher);
	}

	keys() {
		return mkIterator(this, "key");
	}

	values() {
		return mkIterator(this, "value");
	}

	entries() {
		return mkIterator(this, "entry");
	}
}

alias(KeyedLinkedList.prototype, {
	entries: SYM_ITER_KEY,
	push: "set"
});

function assertValidKey(key) {
	if (isPrimitive(key))
		return true;

	console.warn("Invalid key: KeyedLinkedList keys must be primitive");
	return false;
}

function mkIterator(inst, dispatcher) {
	let current = null;

	return new StatelessIterator(
		inst,
		_ => {
			if (current && !current.linked)
				current = inst.find((v, k, kll, n) => n.id > current.id);
			else if (current == null)
				current = inst.head;
			else
				current = current.next;

			if (!current)
				return StatelessIterator.EXIT;

			switch (dispatcher) {
				case "key": return current.key;
				case "value": return current.value;
				case "entry": return [current.key, current.value];
				case "kv-key": return current.value[0];
				case "kv-value": return current.value[1];
				case "kv-entry": return [current.value[0], current.value[1]];
				default: return dispatcher(current);
			}
		}
	);
}
