import {
	sym,
	setSymbol
} from "./sym";
import {
	isObj,
	isObject,
	isPrimitive,
	isArrResolvable,
	isValidObjectKey
} from "./is";
import splitPath from "./split-path";
import hasOwn from "./has-own";
import resolveArgs from "./resolve-args";
import map from "./map";
import get from "./get";

// allowNonexistent - inject property values for
// properties that don't exist on the object
const MAP_OBJ_PARAMS = [
	{ name: "obj", type: "object", required: true},
	{ name: "order", type: Array },
	{ name: "processor", type: "function", default: value => value },
	{ name: "allowNonexistent", type: "boolean", default: true }
];

function mapObj(...args) {
	let {
		obj,
		order,
		processor,
		allowNonexistent
	} = resolveArgs(args, MAP_OBJ_PARAMS);

	order = order || obj._order;

	if (Array.isArray(obj))
		return obj.map(processor);

	const out = [];

	if (order) {
		for (let i = 0, l = order.length; i < l; i++) {
			if (allowNonexistent || hasOwn(obj, order[i]))
				out.push(processor(obj[order[i]], order[i], obj));
		}
	} else {
		for (const k in obj) {
			if (hasOwn(obj, k, false))
				out.push(processor(obj[k], k, obj));
		}
	}

	return out;
}

const keys = typeof Symbol != "undefined" ?
	Object.keys :
	o => {
		if (o == null)
			throw new TypeError("Cannot convert undefined or null to object");

		const out = [];

		for (let k in o) {
			if (!hasOwn(o, k, false))
				continue;

			out.push(k);
		}

		return out;
	};

const IS_DIR_SYM = sym("isDir"),
	DIR_PATH_SYM = sym("dirPath"),
	PARENT_DIR_SYM = sym("parentDir");

function getDirectory(root, path = "", returnRestPath = false) {
	path = splitPath(path);

	if (!isObject(root))
		throw new TypeError("Failed to make directory: root is not a valid directory target");

	if (!isDir(root))
		setDirMeta(root);

	let dir = root,
		restPath = null;

	for (let i = 0, l = path.length; i < l; i++) {
		const key = path[i];

		if (restPath)
			restPath.push(key);
		else if (!hasOwn(dir, key)) {
			const subdir = {};
			setDirMeta(subdir, key, dir[DIR_PATH_SYM], dir);
			dir[key] = subdir;
			dir = subdir;
		} else {
			if (!isDir(dir[key])) {
				if (returnRestPath) {
					restPath = [key];
					continue;
				} else
					throw new Error(`Failed to make directory: '${key}' is not a directory`);
			}

			dir = dir[key];
		}
	}

	if (returnRestPath) {
		return {
			directory: dir,
			restPath
		};
	}

	return dir;
}

function getDirectoryMeta(dir) {
	dir = dir || {};

	return {
		isDirectory: dir[IS_DIR_SYM] || false,
		path: dir[DIR_PATH_SYM] || "",
		parent: dir[PARENT_DIR_SYM] || null
	};
}

function setDirMeta(dir, name = "", path = "", parent = null) {
	setSymbol(dir, IS_DIR_SYM, true);
	setSymbol(dir, DIR_PATH_SYM, path ? `${path}.${name}` : name);
	setSymbol(dir, PARENT_DIR_SYM, parent);
}

function isDir(candidate) {
	return Boolean(candidate) && hasOwn(candidate, IS_DIR_SYM);
}

// NEVER edit these for backwards compatibility
const circularIdKey = "___@qtxr/utils/circular:id",
	circularRefKey = "___@qtxr/utils/circular:ref",
	circularIsKey = "___@qtxr/utils/circular:is-circular";

function uncirculate(obj, options) {
	if (!isObj(obj))
		return obj;

	let circularCount = 0;

	const uncirc = o => {
		const isFrozen = Object.isFrozen(o);

		if (!isFrozen)
			o[circularIdKey] = -1;

		const out = map(o, v => {
			if (!v || typeof v != "object")
				return v;

			if (hasOwn(v, circularIdKey)) {
				if (v[circularIdKey] == -1)
					v[circularIdKey] = circularCount++;

				return {
					[circularRefKey]: v[circularIdKey]
				};
			}

			return uncirc(v);
		}, options);

		if (!isFrozen) {
			if (o[circularIdKey] > -1)
				out[circularIdKey] = o[circularIdKey];
			else
				delete out[circularIdKey];

			delete o[circularIdKey];
		}

		return out;
	};

	const uncirculated = uncirc(obj);

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
	if (!isObj(obj) || !hasOwn(obj, circularIsKey))
		return obj;

	const refs = {};

	const circ = o => {
		const hasId = hasOwn(o, circularIdKey),
			outStruct = isArrResolvable(o) ? [] : {};

		if (hasId)
			refs[o[circularIdKey]] = outStruct;

		const out = map(o, v => {
			if (!isObj(v))
				return v;

			if (hasOwn(v, circularRefKey))
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
	return Boolean(isObj(obj)) && hasOwn(obj, circularIsKey);
}

function getCircularId(obj) {
	if (!isObj(obj) || !hasOwn(obj, circularIdKey))
		return -1;

	return obj[circularIdKey];
}

function setCircularId(obj, id) {
	if (!isObj(obj))
		return;

	obj[circularIdKey] = id;
}

function unenum(obj, key, value) {
	Object.defineProperty(obj, key, {
		enumerable: false,
		writable: true,
		value: value
	});
}

function writeProtect(obj, key) {
	const descriptor = Object.getOwnPropertyDescriptor(obj, key);

	if (!descriptor || !descriptor.writable || !descriptor.configurable)
		return false;

	Object.defineProperty(obj, key, {
		value: obj[key],
		writable: false,
		configurable: true
	});

	return true;
}

function revokeWriteProtect(obj, key) {
	const descriptor = Object.getOwnPropertyDescriptor(obj, key);

	if (!descriptor || !descriptor.configurable)
		return false;

	Object.defineProperty(obj, key, {
		value: obj[key],
		writable: true,
		configurable: true
	});

	return true;
}

function earmark(markKey, items, aliases) {
	const marked = {};

	if (typeof markKey != "symbol" && typeof markKey != "string") {
		console.warn("Cannot earmark: mark is not a string or symbol");
		return marked;
	}

	if (!isObject(items)) {
		console.warn("Cannot earmark: no items to mark");
		return marked;
	}

	const addEarmark = (item, name) => {
		if (isPrimitive(item)) {
			console.warn("Cannot earmark: target is primitive");
			return;
		}

		if (hasOwn(marked, name)) {
			console.warn(`Cannot earmark: correspondence between a target and earmark ${name} has already been establised`);
			return;
		}

		marked[name] = item;
	};

	for (const k in items) {
		if (!hasOwn(items, k))
			continue;

		addEarmark(items[k], k);
		items[k][markKey] = k;

		if (aliases && Array.isArray(aliases[k])) {
			for (let i = 0, l = aliases[k].length; i < l; i++)
				addEarmark(items[k], aliases[k][i]);
		}
	}

	return marked;
}

function reassign(target, source, struct, keyMap) {
	for (const k in keyMap) {
		if (!hasOwn(keyMap, k, false) || !hasOwn(source, k, false))
			continue;

		const keys = keyMap[k];

		for (let i = 0, l = keys.length; i < l; i++) {
			if (hasOwn(struct, keys[i])) {
				target[keys[i]] = source[k];
				break;
			}
		}
	}

	return target;
}

function aliasCore(target, keyOrMap, shallow, ...aliases) {
	let appliedCount = 0;

	const apply = (key, alis) => {
		const ctx = get(target, key, null, "context");
		if (!ctx.match)
			return;

		key = ctx.key;
		alis = Array.isArray(alis) ? alis : [alis];

		let descriptor,
			owner = ctx.context;

		while (true) {
			if (!owner)
				break;

			descriptor = Object.getOwnPropertyDescriptor(owner, key);

			if (descriptor || shallow)
				break;

			owner = Object.getPrototypeOf(owner);
		}

		if (!descriptor)
			return;

		for (let i = 0, l = alis.length; i < l; i++) {
			if (!isValidObjectKey(alis[i]))
				continue;

			const ctx2 = get(target, alis[i], null, "context|autoBuild");
			Object.defineProperty(ctx2.context, ctx2.key, descriptor);
			appliedCount++;
		}
	};

	if (isObject(keyOrMap)) {
		if (aliases.length)
			console.warn("Alias arguments are ignored if a key map is supplied");

		for (const k in keyOrMap) {
			if (hasOwn(keyOrMap, k))
				apply(k, keyOrMap[k]);
		}
	} else
		apply(keyOrMap, aliases);

	return appliedCount;
}

function alias(target, keyOrMap, ...aliases) {
	return aliasCore(target, keyOrMap, false, ...aliases);
}

function aliasOwn(target, keyOrMap, ...aliases) {
	return aliasCore(target, keyOrMap, true, ...aliases);
}

function extend(target, key, value, fallback) {
	if (!hasOwn(target, key) && !Object.isExtensible(target)) {
		if (typeof fallback == "function")
			fallback(target, key, value);

		return false;
	}

	target[key] = value;
	return true;
}

// Deletes a property from a target. Contrary to the delete operator, this function only
// returns whether the deletion was succesful or could happen at all
// Optionally supplies handlers to handle failed checks
const DEF_DEL_HANDLER = _ => false;

function del(target, key, handler = DEF_DEL_HANDLER) {
	if (!target || typeof target != "object")
		return handler("no-object");

	if (!hasOwn(target, key))
		return handler("no-key");

	if (Object.isSealed(target) || Object.isFrozen(target))
		return handler("no-config");

	return delete target[key];
}

export {
	mapObj,
	keys,
	getDirectory,
	getDirectoryMeta,
	uncirculate,
	circulate,
	isCircular,
	getCircularId,
	setCircularId,
	circularIdKey,
	circularRefKey,
	circularIsKey,
	unenum,
	writeProtect,
	revokeWriteProtect,
	earmark,
	reassign,
	alias,
	aliasOwn,
	extend,
	del
};
