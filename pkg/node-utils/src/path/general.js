const path = require("path");

function join(...paths) {
	return path.join(...paths);
}

// Returns a relative path with / as the separator
function pathRelative(pth, pth2) {
	pth = path.relative(stripFileFromPath(pth), pth2);
	pth = pth.split(/\\|\//).join("/");
	// Purely aesthetic - prepends a ./ to a relative path
	pth = (pth[0] != "." && pth[0] != "/") ? `./${pth}` : pth;
	return pth;
}

const filePathRegex = /\..+?$/;

function stripFileFromPath(pth) {
	return splitDirAndFile(pth).dir;
}

function splitDirAndFile(pth) {
	const split = pth.split(/\\|\//);

	if (!filePathRegex.test(split[split.length - 1])) {
		return {
			dir: pth,
			file: null
		};
	}

	const file = split.pop();

	return {
		dir: split.join("/"),
		file
	};
}

function coerceFilePath(pth, extension = "js") {
	if (/\.\w+$/.test(pth))
		return pth;

	return `${pth}.${extension}`;
}

function getFileName(pth) {
	const file = splitDirAndFile(pth).file;
	if (!file)
		return null;

	return stripExtension(file);
}

function stripExtension(file) {
	return file.replace(/(.+?)(?:\..*)?$/, "$1");
}

module.exports = {
	join,
	pathRelative,
	stripFileFromPath,
	splitDirAndFile,
	coerceFilePath,
	getFileName,
	stripExtension
};
