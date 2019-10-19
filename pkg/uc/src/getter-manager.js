import {
	sym,
	get,
	hash,
	clone,
	inject,
	isObj,
	isObject,
	splitPath,
	mkAccessor,
	matchType,
	getDirectory,
	getDirectoryMeta
} from "@qtxr/utils";

export default class GetterManager {
	constructor(getters) {
		this.getters = getDirectory({});

		if (isObject(getters))
			this.addGetters("", getters);

		console.log(this);
	}

	addGetter(path, name, getter) {
		const owner = getDir(this.getters, path);
		mountGetter(owner, name, getter);
		return this;
	}

	addGetters(path, getters) {
		if (isObject(path)) {
			getters = path;
			path = "";
		}

		if (!isObject(getters))
			return this;

		const add = (p, gs) => {
			for (const k in gs) {
				if (!gs.hasOwnProperty(k))
					continue;

				const node = gs[k],
					currPath = [...p, k];
			
				if (isGetter(node))
					this.addGetter(p, k, node);
				else
					add(currPath, node);
			}
		};

		add(splitPath(path), getters);
		return this;
	}

	get(path, config = {}, assets = {}, suppressWarnings = false) {
		path = splitPath(path);
		let groupPath = null,
			rootGetter = null,
			getter = this.getters;

		const warn = (msg, retVal = null) => {
			if (!suppressWarnings)
				console.warn(msg);

			return retVal;
		};

		if (!path.length)
			return warn("Cannot get: invalid path ''");

		for (let i = 0, l = path.length; i < l; i++) {
			if (getter instanceof Getter)
				return warn(`Cannot get: cannot step into Getter`);

			if (getter instanceof GetterGroup) {
				if (!getter.getters.hasOwnProperty(path[i]))
					return warn(`Cannot get: no getter by name '${path[i]}' found in GetterGroup instance`);
			} else {
				if (!getDirectoryMeta(getter).isDirectory)
					return warn(`Cannot get: no directory by name '${path[i]}' at '${mkAccessor(path.slice(0, i - 1))}' found`);
			}

			if (getter instanceof GetterGroup) {
				if (!groupPath) {
					rootGetter = getter;
					groupPath = [];
				}
				
				getter = getter.getters[path[i]];
			} else
				getter = getter[path[i]];

			if (groupPath)
				groupPath.push(path[i]);
		}

		if (!isGetter(getter))
			return warn(`Cannot get: failed to find getter at '${mkAccessor(path)}'`);
		
		return runGetter(getter, config, assets, rootGetter, groupPath);
	}

	getSafe(path, config, assets) {
		return this.get(path, config, assets, true);
	}
}

function runGetter(getter, config = {}, assets = {}, rootGetter = null, groupPath = null) {
	const runtime = {
		config,
		assets
	};

	if (groupPath) {
		if (hasNewGetters(rootGetter)) {
			const fullData = resolveData(rootGetter, config, assets, runtime);
			return resolveCache(fullData, groupPath, 0);
		}

		return resolveData(rootGetter, config, assets, runtime, groupPath, 0);
	}
	
	return resolveData(getter, config, assets, runtime);
}

function resolveData(getter, config, assets, runtime, groupPath, pathPtr) {
	const leaf = getter instanceof Getter,
		shallow = runtime.config == config,
		useCache = !groupPath || !shallow || leaf,
		origConfig = config,
		origAssets = assets,
		cached = getCached(getter, origConfig, origAssets);
		
	if (cached)
		return resolveCache(cached, groupPath, pathPtr);

	const sessions = {};
	let sessionCount = 0,
		data;

	if (!shallow) {
		config = inject(getter.config, config, "cloneTarget");
		assets = inject(getter.assets, assets, "cloneTarget");
	}

	if (leaf) {
		// If the initial config is the same as the current,
		// it's guaranteed that the Getter has been called directly,
		// and so straight injection suffices
		if (shallow) {
			config = inject(config, getter.config, "cloneTarget");
			assets = inject(assets, getter.assets, "cloneTarget");
		} else {
			// Else reference the original data and inject the current
			// accumulation of data
			config = inject(runtime.config, config, "cloneTarget");
			assets = inject(runtime.assets, assets, "cloneTarget");
		}

		const resolver = res => mkResolverSession(res, sessions, sessionCount++);
		data = getter.get(config, assets, resolver);
	} else {
		config = inject(getter.config, config, "cloneTarget");
		assets = inject(getter.assets, assets, "cloneTarget");
		data = getter.get(config, assets, runtime, groupPath, pathPtr);
	}

	if (!sessionCount) {
		if (useCache)
			setCached(data, getter, origConfig, origAssets);
		return data;
	}

	const stack = [config],
		keyStack = [];

	const traverseResolve = (d, key, owner, depth) => {
		if (!isObj(d))
			return d;

		if (isObject(d) && d.hasOwnProperty(resolverSessionIdSym)) {
			const sessionId = d[resolverSessionIdSym],
				session = sessions[sessionId];

			delete sessions[sessionId];
			sessionCount--;

			return runResolve({
				data: d,
				getter,
				session,
				config,
				accessor: mkAccessor(keyStack),
				stack,
				keyStack,
				owner,
				key,
				depth,
				parent: (steps = 1) => stack[stack.length - steps] || null
			});
		}

		stack.push(null);
		keyStack.push(null);

		if (Array.isArray(d)) {
			for (let i = 0, l = d.length; i < l; i++) {
				stack[stack.length - 1] = d[i];
				keyStack[keyStack.length - 1] = i;

				d[i] = traverseResolve(d[i], i, d, depth + 1);

				if (!sessionCount)
					return d;
			}
		} else {
			for (const k in d) {
				if (!d.hasOwnProperty(k))
					continue;

				stack[stack.length - 1] = d[k];
				keyStack[keyStack.length - 1] = k;

				d[k] = traverseResolve(d[k], k, d, depth + 1);

				if (!sessionCount)
					return d;
			}
		}

		stack.pop();
		keyStack.pop();

		return d;
	};

	const resolved = traverseResolve(data, "", data, 0);

	if (sessionCount) {
		console.log(sessions);
		throw new Error(`Failed to fully resolve getter: ${sessionCount} resolver session${sessionCount == 1 ? "" : "s"} remain${sessionCount == 1 ? "s" : ""} unfinished`);
	}

	if (useCache)
		setCached(resolved, getter, origConfig, origAssets);

	return resolved;
}

function resolveCache(cached, groupPath, pathPtr) {
	if (!groupPath)
		return cached;

	return get(cached, groupPath, null, {
		pathOffset: pathPtr
	});
}

const resolverSessionIdSym = sym("resolverSessionId");

function mkResolverSession(resolver, sessions, id) {
	const session = {
		resolver,		// resolver function/accessor
		type: null,		// data type
		default: null,	// Default value if getting data is unsuccessful (data is undefined)
		ext: null,		// Object that's to be extended by data
		as(type) {
			this.type = type;
			return this;
		},
		or(def) {
			this.default = def;
			return this;
		},
		extends(ext) {
			this.ext = ext;
			return this;
		},
		[resolverSessionIdSym]: id
	};

	sessions[id] = session;

	return session;
}

function runResolve(args) {
	const { session } = args,
		def = resolveSessionValue(args, session.default),
		extension = resolveSessionValue(args, session.ext);

	let resolved = resolveSessionValue(args, session.resolver, true);
	const typeMatch = matchType(resolved, session.type);

	if (typeMatch) {
		if (isObj(resolved) && isObj(extension))
			return inject(resolved, extension, "cloneTarget");
	}

	if (resolved === undefined || !typeMatch) {
		resolved = clone(def);

		if (isObj(extension))
			resolved = inject(resolved, extension, "cloneTarget");
	}

	return resolved;
}

function resolveSessionValue(args, value, ignoreStringMatch) {
	const {
		session,
		config
	} = args;

	if ((typeof value != "string" || !ignoreStringMatch) && matchType(value, session.type, "falseDefault"))
		return value;

	if (typeof value == "string")
		value = get(config, value);

	if (matchType(value, session.type, "falseDefault"))
		return value;

	if (typeof value == "function")
		value = value(args);

	return value;
}

function getDir(root, path) {
	let {
		directory: dir,
		restPath
	} = getDirectory(root, path, true);

	if (!restPath)
		return dir;

	dir = dir[restPath[0]];

	if (!(dir instanceof GetterGroup))
		throw new Error(`Failed to make directory: '${restPath[0]}' is not a directory`);

	for (let i = 1, l = restPath.length; i < l; i++) {
		const key = restPath[i],
			getters = dir.getters;

		if (!getters.hasOwnProperty(key)) {
			dir = new GetterGroup(key, dir, {
				get: {}
			});
			getters[key] = dir;
		} else {
			if (!(dir instanceof GetterGroup))
				throw new Error(`Failed to make directory: '${key}' is not a directory`);

			dir = getters[key];
		}
	}

	return dir;
}

// A getter (leaf) node is defined as an
// object with a getter function at .get (or .getters for objects)
function isGetter(candidate) {
	if (candidate instanceof Getter || candidate instanceof GetterGroup)
		return true;

	if (!isObject(candidate) || (!candidate.get && !candidate.getters))
		return false;

	return typeof candidate.get == "function" || typeof candidate.get == "object" || typeof candidate.getters == "object";
}

function mountGetter(owner, name, data) {
	const target = (owner instanceof GetterGroup) ? owner.getters : owner;
	let getter;

	if (target.hasOwnProperty(name))
		throw new Error(`Cannot add getter: getter by name '${name}' already exists`);

	if (typeof data == "function") {
		data = {
			get: data
		};
	}

	if (!isGetter(data))
		throw new Error("Cannot make getter: supplied getter is malformed");
	if (!name || typeof name != "string")
		throw new Error("Cannot make getter: name must be a truthy string");

	if (owner instanceof GetterGroup)
		owner.logNewGetter(name);

	if (isObject(data.get || data.getters))
		getter =  new GetterGroup(name, owner, data);
	else
		getter = new Getter(name, owner, data);

	target[name] = getter;
	return getter;
}

class Getter {
	constructor(name, owner, data) {
		this.name = name;
		this.owner = owner;
		this.stats = {
			gets: 0
		};
		this.cache = {
			last: null,
			config: {},
			assets: {},
			inputs: {}
		};

		// Data payload
		this.cachePolicy = data.cachePolicy || "none";
		this.config = isObject(data.config) ? data.config : {};
		this.assets = isObject(data.assets) ? data.assets : {};
		this.getter = data.get;
	}

	get(config, assets, resolver) {
		this.stats.gets++;
		return this.getter(config, assets, resolver, this);
	}
}

class GetterGroup {
	constructor(name, owner, data) {
		this.name = name;
		this.owner = owner;
		this.stats = {
			gets: 0
		};
		this.getters = {};
		this.cache = {
			last: null,
			config: {},
			assets: {},
			inputs: {}
		};
		this.newGetters = {};
		this.newGettersCount = 0;
		this.scopedNewGetters = {};
		this.scopedNewGettersCount = 0;

		// Data payload
		this.cachePolicy = data.cachePolicy || "none";
		this.config = isObject(data.config) ? data.config : {};
		this.assets = isObject(data.assets) ? data.assets : {};

		const getters = data.get || data.getters;

		for (const k in getters) {
			if (!getters.hasOwnProperty(k))
				continue;

			mountGetter(this, k, getters[k]);
		}
	}

	get(config, assets, runtime, groupPath, pathPtr) {
		if (groupPath && pathPtr < groupPath.length) {
			const name = groupPath[pathPtr];
			this.unlogNewGetter(name);

			return resolveData(
				this.getters[name],
				config,
				assets,
				runtime,
				groupPath,
				pathPtr + 1
			);
		}

		const out = {};

		for (const k in this.getters) {
			if (!this.getters.hasOwnProperty(k))
				continue;
			
			this.unlogNewGetter(k);
			out[k] = resolveData(this.getters[k], config, assets, runtime);
		}

		this.stats.gets++;

		return out;
	}

	logNewGetter(name) {
		if (this.getters.hasOwnProperty(name) || this.newGetters.hasOwnProperty(name))
			return;

		this.newGetters[name] = true;
		this.newGettersCount++;

		let group = this;
		while (true) {
			group.scopedNewGetters[name] = (group.scopedNewGetters[name] || 0) + 1;
			group.scopedNewGettersCount++;

			group = group.owner;

			if (!(group instanceof GetterGroup))
				break;
		}
	}

	unlogNewGetter(name) {
		if (!this.newGetters.hasOwnProperty(name))
			return;

		delete this.newGetters[name];
		this.newGettersCount--;

		let group = this;
		while (true) {
			group.scopedNewGetters[name]--;
			group.scopedNewGettersCount--;

			group = group.owner;

			if (!(group instanceof GetterGroup))
				break;
		}
	}
}

function hasNewGetters(getter) {
	if (!(getter instanceof GetterGroup))
		return false;

	return Boolean(getter.scopedNewGettersCount);
}

function getCached(getter, config, assets) {
	if (hasNewGetters(getter))
		return null;

	switch (getter.cachePolicy) {
		case "permanent":
			return getter.cache.last;
		case "same-config":
			return getter.cache.config[hash(config)] || null;
		case "same-assets":
			return getter.cache.assets[hash(assets)] || null;
		case "same-inputs":
			return getter.cache.inputs[`${hash(config)}::${hash(assets)}`] || null;
		default:
			return null;
	}
}

function setCached(data, getter, config, assets) {
	getter.cache.last = data;

	switch (getter.cachePolicy) {
		case "same-config":
			getter.cache.config[hash(config)] = data;
			break;
		case "same-assets":
			getter.cache.assets[hash(assets)] = data;
			break;
		case "same-inputs":
			getter.cache.inputs[`${hash(config)}::${hash(assets)}`] = data;
			break;
	}
}
