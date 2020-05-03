import {
	alias,
	forEach,
	isPrimitive,
	isArrayLike
} from "@qtxr/utils";
import { SYM_ITER_KEY } from "@qtxr/utils/internal";
import Iterator from "./internal/iterator";

let id = 0;

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

		const node = (this.enforceUnique && this.pluck(this.map[key])) || {
			key,
			owner: this
		};

		node.value = value;
		node.next = next;
		node.previous = previous;
		node.linked = true;
		node.id = id++;

		if (previous)
			previous.next = node;
		else
			this.head = node;

		if (next)
			next.previous = node;
		else
			this.tail = node;

		if (this.enforceUnique)
			this.map[key] = node;
		else if (!this.map[key])
			this.map[key] = [node];
		else
			this.map[key].push(node);

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
				delete this.map[node.key];
			else {
				const partition = this.map[node.key];

				if (partition.length == 1)
					delete this.map[node.key];
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
		return assertValidKey(key) && Boolean(this.map[key]);
	}

	get(key) {
		return (assertValidKey(key) && this.map[key]) || (this.enforceUnique ? null : []);
	}

	delete(key) {
		if (!assertValidKey(key) || !this.has(key))
			return false;

		if (this.enforceUnique)
			this.pluck(this.map[key], true);
		else {
			const partition = this.map[key];

			for (let i = 0, l = partition.length; i < l; i++)
				this.pluck(partition[i], true);
		}

		delete this.map[key];
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

alias(KeyedLinkedList.prototype, "entries", SYM_ITER_KEY);

function assertValidKey(key) {
	if (isPrimitive(key))
		return true;

	console.warn("Invalid key: KeyedLinkedList keys must be primitive");
	return false;
}

function mkIterator(inst, dispatcher) {
	let n,
		v;

	return new Iterator(
		inst,
		inst.head,
		iterator => {
			n = iterator.nextIdentifier;

			if (n == null)
				n = inst.head;
			else if (typeof n == "number")
				n = inst.find((_, k) => k > n);
			else if (!n.linked)
				n = inst.find((_, k) => k > n.id);

			if (!n)
				return null;

			switch (dispatcher) {
				case "key":
					v = n.key;
					break;

				case "value":
					v = n.value;
					break;

				case "entry":
					v = [n.key, n.value];
					break;

				case "kv-key":
					v = n.value[0];
					break;

				case "kv-value":
					v = n.value[1];
					break;

				case "kv-entry":
					v = [n.value[0], n.value[1]];
					break;

				default:
					v = dispatcher(n);
			}

			return {
				value: v,
				nextIdentifier: n.next || n.id + 1
			};
		}
	);
}
