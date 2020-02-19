export default class Trie {
	constructor() {
		this.root = {
			childCount: 0,
			parent: null,
			keys: []
		};

		this.ref = Object.create(null);
		this.size = 0;
		this.nodeCount = 1;
		this.sortKeys = true;
	}

	add(key, value) {
		if (arguments.length == 1)
			value = key;

		key = conformKey(key);
		if (key == null)
			return this;

		if (this.ref[key]) {
			this.ref[key].value = value;
			return this;
		}

		const length = key.length;
		let trieNode = this.root;

		for (let i = 0; i < length; i++) {
			const char = key[i];
			let currNode = trieNode[char];

			if (!trieNode.hasOwnProperty(char)) {
				trieNode.childCount++;
				this.nodeCount++;

				trieNode[char] = currNode = {
					childCount: 0,
					parent: trieNode,
					keys: []
				};

				insertSequentially(trieNode.keys, char, this.sortKeys);
			}

			if (i == length - 1)
				currNode.value = value;

			trieNode = currNode;
		}

		this.size++;
		this.ref[key] = trieNode;
		return this;
	}

	get(key) {
		key = conformKey(key);
		if (key == null || !this.ref[key])
			return;

		return this.ref[key].value;
	}

	delete(key) {
		key = conformKey(key);
		if (key == null || !this.has(key))
			return false;

		const length = key.length;
		let trieNode = this.root;

		for (let i = 0; i < length; i++) {
			const char = key[i];

			if (!trieNode.hasOwnProperty(char))
				break;

			trieNode = trieNode[char];
			if (i == length - 1)
				deleteBranch(this, trieNode, key);
		}

		this.ref[key] = false;
		this.size--;
		return true;
	}

	has(key) {
		key = conformKey(key);
		return key != null && Boolean(this.ref[key]);
	}

	matchMin(next) {
		if (typeof next == "string")
			next = mkDefNext(next);

		let match = "",
			node = this.root,
			count = 0;

		while (true) {
			const char = next(count++);

			if (!node.hasOwnProperty(char))
				break;

			match += char;
			node = node[char];

			if (node.hasOwnProperty("value")) {
				return {
					key: match,
					value: node.value,
					node
				};
			}
		}

		return null;
	}

	matchMax(next) {
		if (typeof next == "string")
			next = mkDefNext(next);

		let match = "",
			lastMatch = null,
			node = this.root,
			count = 0;

		while (true) {
			const char = next(count++);

			if (!node.hasOwnProperty(char))
				break;

			match += char;
			node = node[char];

			if (node.hasOwnProperty("value"))
				lastMatch = match;
		}

		return lastMatch ? {
			key: lastMatch,
			value: this.ref[lastMatch].value,
			node: this.ref[lastMatch]
		} : null;
	}

	getNode(key = "") {
		if (this.ref[key])
			return this.ref[key];

		let c = null,
			idx = 0,
			node = this.root;

		while (c = key[idx++], c) {
			if (!node.hasOwnProperty(c))
				return null;
			
			node = node[c];
		}

		return node;
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
		const trieNode = this.getNode(key),
			matches = [];

		if (!trieNode)
			return matches;

		const collect = (node, str) => {
			if (node.hasOwnProperty("value")) {
				switch (type) {
					case "key":
						matches.push(str);
						break;

					case "value":
						matches.push(node.value);
						break;

					case "entry":
						matches.push([str, node.value]);
						break;
				}
			}

			for (let i = 0; i < node.childCount; i++)
				collect(node[node.keys[i]], str + node.keys[i]);
		};

		collect(trieNode, key);
		return matches;
	}
}

function deleteBranch(trie, node, key) {
	let charPtr = key.length;

	delete node.value;

	while (!node.childCount && node.parent) {
		const char = key[--charPtr];
		node = node.parent;

		node.childCount--;
		trie.nodeCount--;
		removeSequentially(node.keys, char, trie.sortKeys);
		delete node[char];

		if (node.hasOwnProperty("value"))
			break;
	}
}

function mkDefNext(str) {
	return idx => {
		return str[idx];
	};
}

function conformKey(key) {
	switch (typeof key) {
		case "string":
			return key;

		case "number":
		case "bigint":
			return String(key);
	}

	return null;
}

function insertSequentially(keys, key, sortKeys) {
	if (sortKeys)
		keys.splice(sequentialBinaryIndex(keys, key), 0, key);
	else
		keys.push(key);
}

function removeSequentially(keys, key, sortKeys) {
	if (sortKeys)
		keys.splice(sequentialBinaryIndex(keys, key), 1);
	else
		keys.splice(keys.indexOf(key), 1);
}

// Custom binary search. It assumes the following:
// - If searching for a key which is not in the array, it will
//   return the position into which to insert the value
// - If the key exists, it will return its exact location
function sequentialBinaryIndex(keys, key) {
	let start = 0,
		end = keys.length - 1,
		pivot,
		keyAtPivot;

	while (true) {
		if (end < start)
			return start;

		pivot = Math.floor((start + end) / 2);
		keyAtPivot = keys[pivot];

		if (keyAtPivot == key)
			return pivot;
		if (keyAtPivot > key)
			end = pivot - 1;
		else
			start = pivot + 1;
	}
}
