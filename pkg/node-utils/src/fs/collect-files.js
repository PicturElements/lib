const traverseFileTree = require("./traverse-file-tree");

module.exports = function collectFiles(root) {
	return traverseFileTree(root, (node, acc) => {
		if (node.type == "file")
			acc.push(node);
	}, []);
};
