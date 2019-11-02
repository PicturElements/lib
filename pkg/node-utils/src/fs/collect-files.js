const path = require("path");
const collectFileTree = require("./collect-file-tree");
const {
	splitDirAndFile,
	splitFileAndExtension
} = require("../path/general");

async function collectFiles(root) {
	const files = [];
	const tree = await collectFileTree(root);

	function collect(t, pth) {
		for (const k in t) {
			if (!t.hasOwnProperty(k))
				continue;
	
			const p = pth.concat(k);

			if (typeof t[k] == "object")
				collect(t[k], p);
			else {
				const df = splitDirAndFile(t[k]),
					fe = splitFileAndExtension(df.file);

				files.push({
					dir: df.dir,
					file: df.file,
					fileName: fe.file,
					extension: df.extension,
					path: path.join(...p),
					fullPath: t[k]
				});
			}
		}
	}

	collect(tree, []);
	return files;
}
