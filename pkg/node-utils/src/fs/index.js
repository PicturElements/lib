module.exports = {
	collectFileTree: require("./collect-file-tree"),
	...require("./dir"),
	...require("./file"),
	...require("./json"),
	...require("./general")
};
