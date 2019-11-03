const path = require("path");
const { readdir } = require("./dir");
const { stat } = require("./general");
const { splitFileAndExtension } = require("../path/general");

module.exports = async function traverseFileTree(root, processor, postprocessor, accumulator) {
	if (typeof postprocessor != "function") {
		accumulator = postprocessor;
		postprocessor = null;
	}

	let cwd = "",
		rootPath = "";

	if (root && typeof root == "object") {
		cwd = root.cwd || cwd;
		rootPath = root.path || rootPath;
	} else
		rootPath = root;

	async function traverse(dirPath, acc, depth) {
		const absPath = path.join(cwd, dirPath),
			files = await readdir(absPath);
		let matched = false;

		if (!files)
			return acc;

		for (const file of files) {
			const workingPath = path.join(dirPath, file),
				absWorkingPath = path.join(cwd, workingPath),
				s = await stat(absWorkingPath);
			let node;

			if (!s)
				return acc;

			if (s.isDirectory()) {
				node = {
					type: "directory",
					dir: dirPath,
					dirName: file,
					file,
					files,
					depth,
					path: workingPath,
					fullPath: absWorkingPath
				};

				const candidateAcc = processor(node, acc);

				await traverse(
					workingPath,
					candidateAcc !== undefined ? candidateAcc : acc,
					depth + 1
				);
			} else {
				const fe = splitFileAndExtension(file);

				node = {
					type: "file",
					dir: dirPath,
					file,
					files,
					depth,
					fileName: fe.file,
					extension: fe.extension,
					path: workingPath,
					fullPath: absWorkingPath
				};

				processor(node, acc);
			}

			if (typeof postprocessor == "function")
				postprocessor(node, acc);
		}

		return acc;
	}

	await traverse(rootPath, accumulator, 0);
	return accumulator;
};
