const traverseFileTree = require("./traverse-file-tree");

module.exports = async function collectFileTree(root, filter, terse) {
	const mapKey = (root && root.mapKey) || "fullPath";

	return traverseFileTree(root, (node, acc) => {
		if (node.type == "directory") {
			acc[node.dirName] = {};
			return acc[node.dirName];
		}

		acc[node.file] = node[mapKey];
	}, (node, acc) => {
		if (terse && node.type == "directory" && !Object.keys(acc[node.dirName]).length)
			delete acc[node.dirName];
	}, {});
};
