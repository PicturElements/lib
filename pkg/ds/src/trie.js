import {
	sym,
	hasOwn,
	isObject
} from "@qtxr/utils";
import KeyedLinkedList from "./keyed-linked-list";
import { typeHash } from "./internal/utils";

const PARENT = sym("parent"),
	KEY = sym("key"),
	CHILDREN = sym("children"),
	VALUE = sym("value");

export default class Trie {
	constructor() {
		this.root = mkNode(null);
		this.ref = Object.create(null);
		this.size = 0;
		this.nodeCount = 1;
	}

	set(...args) {
		const key = conformKey(args[0]),
			isArrayKey = Array.isArray(key),
			value = args.length < 2 ? args[0] : args[1];

		if (key == null)
			return this;

		if (!isArrayKey && this.ref[key]) {
			this.ref[key][VALUE] = value;
			return this;
		}

		const length = key.length;
		let node = this.root,
			matched = false;

		for (let i = 0; i < length; i++) {
			const c = isArrayKey ?
				typeHash(key[i]) :
				key[i];
			let currNode = node[c];

			if (!hasOwn(node, c)) {
				this.nodeCount++;
				currNode = mkNode(node);
				node[CHILDREN].set(key[i], currNode);
				node[c] = currNode;
			} else if (i == length - 1 && hasOwn(currNode, VALUE))
				matched = true;

			if (i == length - 1) {
				currNode[VALUE] = value;
				currNode[KEY] = key;
			}

			node = currNode;
		}

		if (!matched)
			this.size++;
		if (!isArrayKey)
			this.ref[key] = node;
		return this;
	}

	get(key) {
		key = conformKey(key);
		if (key == null)
			return;

		if (Array.isArray(key)) {
			const node = this.getNode(key);
			return node && node[VALUE];
		}
		
		if (!this.ref[key])
			return;

		return this.ref[key][VALUE];
	}

	delete(key) {
		key = conformKey(key);
		if (key == null)
			return false;

		const length = key.length,
			isArrayKey = Array.isArray(key);
		let node = this.root,
			deleted = false;

		if (!isArrayKey && !this.has(key))
			return false;

		for (let i = 0; i < length; i++) {
			const c = isArrayKey ?
				typeHash(key[i]) :
				key[i];

			if (!hasOwn(node, c))
				break;

			node = node[c];
			if (i == length - 1 && hasOwn(node, VALUE)) {
				deleted = true;
				deleteBranch(this, node, key);
			}
		}

		if (!deleted)
			return false;

		if (!isArrayKey)
			this.ref[key] = false;
		this.size--;
		return true;
	}

	has(key) {
		key = conformKey(key);

		if (Array.isArray(key)) {
			const node = this.getNode(key);
			return Boolean(node && hasOwn(node, VALUE));
		}
		
		return key != null && Boolean(this.ref[key]);
	}

	matchMin(next) {
		if (typeof next != "function")
			next = mkDefNext(next);

		let node = this.root,
			idx = 0;

		while (true) {
			const c = next(idx++);

			if (!hasOwn(node, c))
				break;

			node = node[c];

			if (hasOwn(node, VALUE)) {
				return {
					key: node[KEY],
					value: node[VALUE],
					node,
					depth: idx - 1
				};
			}
		}

		return null;
	}

	matchMax(next) {
		if (typeof next != "function")
			next = mkDefNext(next);

		let lastMatch = null,
			node = this.root,
			idx = 0;

		while (true) {
			const c = next(idx++);

			if (!c || !hasOwn(node, c))
				break;

			node = node[c];

			if (hasOwn(node, VALUE))
				lastMatch = node;
		}

		return lastMatch ? {
			key: lastMatch[KEY],
			value: lastMatch[VALUE],
			node: lastMatch,
			depth: idx - 1
		} : null;
	}

	// FIX
	getNode(key = "") {
		key = conformKey(key);
		if (!key)
			return null;

		const length = key.length,
			isArrayKey = Array.isArray(key);

		if (!isArrayKey && this.ref[key])
			return this.ref[key];

		let node = this.root;

		for (let i = 0; i < length; i++) {
			const c = isArrayKey ?
				typeHash(key[i]) :
				key[i];

			if (!hasOwn(node, c))
				return null;
			
			node = node[c];
		}

		return node;
	}

	getNodeData(keyOrNode = "") {
		const node = isObject(keyOrNode) ?
			keyOrNode :
			this.getNode(keyOrNode);

		if (!node)
			return null;

		return {
			key: node[KEY],
			value: node[VALUE],
			parent: node[PARENT],
			children: node[CHILDREN],
			childCount: node[CHILDREN].size,
			hasValue: hasOwn(node, VALUE)
		};
	}

	getMatchKeys(key = "") {
		return this.getMatches(key, "key");
	}

	getMatchValues(key = "") {
		return this.getMatches(key, "value");
	}

	getMatchEntries(key = "") {
		return this.getMatches(key, "entry");
	}

	getMatches(key, type) {
		key = conformKey(key);
		const node = this.getNode(key),
			matches = [];

		if (!node)
			return matches;

		const collect = n => {
			if (hasOwn(n, VALUE)) {
				switch (type) {
					case "key":
						matches.push(n[KEY]);
						break;

					case "value":
						matches.push(n[VALUE]);
						break;

					case "entry":
					default:
						matches.push([n[KEY], n[VALUE]]);
						break;
				}
			}

			n[CHILDREN].forEach(n => collect(n));
		};

		collect(node, key);
		return matches;
	}
}

function deleteBranch(trie, node, key) {
	const isArrayKey = Array.isArray(key);
	let ptr = key.length;

	delete node[VALUE];
	delete node[KEY];

	while (!node[CHILDREN].size && node[PARENT]) {
		const c = key[--ptr];
		node = node[PARENT];
		node[CHILDREN].delete(c);
		trie.nodeCount--;

		if (isArrayKey)
			delete node[typeHash(c)];
		else
			delete node[c];

		if (hasOwn(node, VALUE))
			break;
	}
}

function mkNode(parent) {
	return {
		[PARENT]: parent,
		[CHILDREN]: new KeyedLinkedList()
	};
}

function mkDefNext(candidate) {
	if (typeof candidate == "string")
		return mkDefNextStr(candidate);

	if (Array.isArray(candidate))
		return mkDefNextArr(candidate);

	return _ => null;
}

function mkDefNextStr(str) {
	return idx => {
		return str[idx];
	};
}

function mkDefNextArr(arr) {
	return idx => {
		return typeHash(arr[idx]);
	};
}

function conformKey(key) {
	if (Array.isArray(key))
		return key;

	switch (typeof key) {
		case "string":
			return key;

		case "number":
		case "bigint":
			return String(key);
	}

	return null;
}
