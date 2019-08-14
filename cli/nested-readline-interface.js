const { Interface } = require("readline");

const interfaces = {};

module.exports = class NestedReadlineInterface extends Interface {
	// redline.createInterface simply wraps an Interface instantiation
	// https://github.com/nodejs/node/blob/f9c267e9514f1363c72f062a5971ae07dbe32634/lib/readline.js#L77
	constructor(partitionName, ...args) {
		super(...args);
		this.partitionName = partitionName;
	}

	close() {
		const partition = interfaces[this.partitionName];
		partition.depth--;

		if (!partition.depth) {
			partition.instance = null;
			super.close();
		}
	}

	// NestedReadlineInterface implements the singleton pattern
	// in order to emulate nested readlines
	static create(partitionName, ...args) {
		if (!interfaces.hasOwnProperty(partitionName)) {
			interfaces[partitionName] = {
				instance: null,
				depth: 0
			};
		}

		if (!interfaces[partitionName].depth) {
			const inst = new NestedReadlineInterface(partitionName, ...args);
			interfaces[partitionName].instance = inst;
			interfaces[partitionName].depth++;
			return inst;
		}

		interfaces[partitionName].depth++;
		return interfaces[partitionName].instance;
	}
};
