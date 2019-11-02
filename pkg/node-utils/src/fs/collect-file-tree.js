const path = require("path");
const { readdir } = require("./dir");
const { stat } = require("./general");

module.exports = async function collectFileTree(root, filter, terse) {
	async function collect(dirPath) {
		const dir = {},
			files = await readdir(dirPath);
		let matched = false;

		if (!files)
			return null;

		for (const file of files) {
			const workingPath = path.join(dirPath, file),
				s = await stat(workingPath);
			let item = null;

			if (!s)
				return;

			if (s.isDirectory())
				item = await collect(workingPath);
			else if (typeof filter != "function")
				item = workingPath;
			else if (filter(file, workingPath))
				item = workingPath;

			if (item) {
				dir[file] = item;
				matched = true;
			}
		}

		return !terse || matched ? dir : null;
	}

	return await collect(root);
};
