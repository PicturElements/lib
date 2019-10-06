const path = require("path");

function join(...paths) {
	return path.join(...paths);
}

function joinDir(...paths) {
	return path.join(__dirname, "..", ...paths);
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
	const split = pth.split(/\\|\//);

	if (!filePathRegex.test(split[split.length - 1]))
		return pth;

	split.pop();
	
	return split.join(path.sep);
}

function coerceFilePath(pth, extension = "js") {
	if (/\.\w+$/.test(pth))
		return pth;

	return `${pth}.${extension}`;
}

module.exports = {
	join,
	joinDir,
	pathRelative,
	stripFileFromPath,
	coerceFilePath
};
