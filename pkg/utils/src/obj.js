import {
	sym,
	setSymbol
} from "./sym";
import {
	isObj,
	isObject,
	isArrResolvable,
	isNativeSimpleObject
} from "./is";
import splitPath from "./split-path";
import hasOwn from "./has-own";
import resolveArgs from "./resolve-args";
import map from "./map";

// allowNonexistent - inject property values for
// properties that don't exist on the object
const objToArrParamSignature = [
	{ name: "obj", type: "object", required: true},
	{ name: "order", type: Array },
	{ name: "processor", type: "function", default: (val, key, obj) => val },
	{ name: "allowNonexistent", type: "boolean", default: true }
];

export default function objToArr(...args) {
	let {
		obj,
		order,
		processor,
		allowNonexistent
	} = resolveArgs(args, objToArrParamSignature);

	order = order || obj._order;

	if (Array.isArray(obj))
		return obj.map(processor);

	const out = [];

	if (order) {
		for (let i = 0, l = order.length; i < l; i++) {
			if (obj.hasOwnProperty(order[i]) || allowNonexistent)
				out.push(processor(obj[order[i]], order[i], obj));
		}
	} else {
		for (const k in obj) {
			if (obj.hasOwnProperty(k))
				out.push(processor(obj[k], k, obj));
		}
	}

	return out;
}

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
	setSymbol(dir, dirPathSym, path ? `${path}.${name}` : name);
	setSymbol(dir, parentDirSym, parent);
}

function isDir(candidate) {
	return Boolean(candidate) && candidate.hasOwnProperty(isDirSym);
}

// NEVER edit these for backwards compatibility
const circularIdKey = "___@qtxr/utils/circular:id",
	circularRefKey = "___@qtxr/utils/circular:ref",
	circularIsKey = "___@qtxr/utils/circular:is-circular";

function uncirculate(obj, options) {
	if (!isObj(obj))
		return obj;

	let circularCount = 0;

	const ucirc = o => {
		o[circularIdKey] = -1;

		const out = map(o, v => {
			if (!isNativeSimpleObject(v))
				return v;

			if (v.hasOwnProperty(circularIdKey)) {
				if (v[circularIdKey] == -1)
					v[circularIdKey] = circularCount++;

				return {
					[circularRefKey]: v[circularIdKey]
				};
			}

			return ucirc(v);
		}, options);
		
		if (o[circularIdKey] > -1)
			out[circularIdKey] = o[circularIdKey];

		delete o[circularIdKey];
		return out;
	};

	const uncirculated = ucirc(obj);

	if (circularCount) {
		return {
			[circularIsKey]: true,
			data: uncirculated,
			count: circularCount
		};
	}

	return uncirculated;
}

function circulate(obj, options) {
	if (!isObj(obj) || !obj.hasOwnProperty(circularIsKey))
		return obj;

	const refs = {};

	const circ = o => {
		const hasId = o.hasOwnProperty(circularIdKey),
			outStruct = isArrResolvable(o) ? [] : {};

		if (hasId)
			refs[o[circularIdKey]] = outStruct;

		const out = map(o, v => {
			if (!isObj(v))
				return v;

			if (v.hasOwnProperty(circularRefKey))
				return refs[v[circularRefKey]];

			return circ(v);
		}, options, outStruct);

		if (hasId) {
			delete o[circularIdKey];
			delete out[circularIdKey];
		}

		return out;
	};

	return circ(obj.data);
}

function isCircular(obj) {
	return Boolean(isObj(obj)) && obj.hasOwnProperty(circularIsKey);
}

function getCircularId(obj) {
	if (!isObj(obj) || !obj.hasOwnProperty(circularIdKey))
		return -1;

	return obj[circularIdKey];
}

function setCircularId(obj, id) {
	if (!isObj(obj))
		return;

	obj[circularIdKey] = id;
}

export {
	objToArr,
	keys,
	getDirectory,
	getDirectoryMeta,
	uncirculate,
	circulate,
	isCircular,
	getCircularId,
	setCircularId
};
