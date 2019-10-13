import {
	sym,
	setSymbol
} from "./sym";
import { isObject } from "./is";
import splitPath from "./split-path";
import hasOwn from "./has-own";

const keys = typeof Symbol == "undefined" ? Object.keys : o => {
	if (o == null)
		throw new TypeError("Cannot convert undefined or null to object");

	const out = [];

	for (let k in o) {
		if (!hasOwn(o, k))
			continue;

		out.push(k);
	}

	return out;
};

const isDirSym = sym("isDir"),
	dirPathSym = sym("dirPath"),
	parentDirSym = sym("parentDir");

function getDirectory(root, path = "") {
	path = splitPath(path);

	if (!isObject(root))
		throw new TypeError("Failed to make directory: root is not a valid directory target");

	if (!isDir(root))
		setDirMeta(root);

	let dir = root;

	for (let i = 0, l = path.length; i < l; i++) {
		const key = path[i];

		if (!dir.hasOwnProperty(key)) {
			const subdir = {};
			setDirMeta(subdir, key, dir[dirPathSym], dir);
			dir[key] = subdir;
			dir = subdir;
		} else {
			if (!isDir(dir[key]))
				throw new Error(`Failed to make directory: '${key}' is not a directory`);

			dir = dir[key];
		}
	}

	return dir;
}

function getDirectoryMeta(dir) {
	dir = dir || {};

	return {
		isDirectory: dir[isDirSym] || false,
		path: dir[dirPathSym] || "",
		parent: dir[parentDirSym] || null
	};
}

function setDirMeta(dir, name = "", path = "", parent = null) {
	setSymbol(dir, isDirSym, true);
	setSymbol(dir, dirPathSym, path ? `${path}/${name}` : name);
	setSymbol(dir, parentDirSym, parent);
}

function isDir(candidate) {
	return Boolean(candidate) && candidate.hasOwnProperty(isDirSym);
}

export {
	keys,
	getDirectory,
	getDirectoryMeta
};
