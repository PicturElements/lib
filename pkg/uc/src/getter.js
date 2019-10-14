import {
	sym,
	get,
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

export default class Getter {
	constructor(getters) {
		this.getters = getDirectory({});

		if (isObject(getters))
			this.addGetters("", this.getters);
	}

	addGetter(path, name, getter) {
		const dir = getDirectory(this.getters, path),
			dirMeta = getDirectoryMeta(dir);

		if (!isGetterNode(getter))
			throw new Error("Cannot add getter: supplied getter is malformed");
		if (!name || typeof name != "string")
			throw new Error("Cannot add getter: name must be a truthy string");
		if (dir.hasOwnProperty(name))
			throw new Error(`Cannot add getter: getter by name '${name}' already exists in this directory (${dirMeta.path})`);

		getter = Object.assign({
			name,
			directory: dir
		}, getter);

		dir[name] = getter;

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
			
				if (isGetterNode(node))
					this.addGetter(p, k, node);
				else
					add(currPath, node);
			}
		};

		add(splitPath(path), getters);
		return this;
	}

	get(path, config = {}, resolverData = {}) {
		path = splitPath(path);
		let getter = this.getters;

		if (!path.length)
			throw new Error("Cannot get: invalid path ''");

		for (let i = 0, l = path.length; i < l; i++) {
			if (!getDirectoryMeta(getter).isDirectory)
				throw new Error(`Cannot get: no directory by name '${path[i]}' found`);

			getter = getter[path[i]];
		}

		if (!isGetterNode(getter))
			throw new Error("Cannot get: failed to find getter");

		return runGetter(getter, config, resolverData);
	}
}

function runGetter(getter, config = {}, resolverData = {}) {
	let sessionCount = 0;
	const sessions = {},
		resolver = res => mkResolverSession(res, sessions, sessionCount++);

	config = inject(config, getter.config, "cloneTarget");
	resolverData = resolverData || {};

	const data = getter.get(config, resolver),
		stack = [config],
		keyStack = [];

	if (!sessionCount)
		return data;

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
				resolverData,
				getter,
				session,
				config,
				accessor: mkAccessor(keyStack),
				stack,
				keyStack,
				owner,
				key,
				depth
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
		throw new Error(`Failed to fully resolve getter: ${sessionCount} resolver session${sessionCount == 1 ? "" : "s"} remain unfinished`);
	}

	return resolved;
}

const resolverSessionIdSym = sym("resolverSessionId");

function mkResolverSession(resolver, sessions, id) {
	const session = {
		resolver,
		type: null,
		default: null,
		as(type) {
			this.type = type;
			return this;
		},
		or(def) {
			this.default = def;
			return this;
		},
		[resolverSessionIdSym]: id
	};

	sessions[id] = session;

	return session;
}

function runResolve(args) {
	const {
		session,
		resolverData
	} = args;
	let resolver = session.resolver,
		resolved;

	// Resolve references to resolverData
	if (typeof resolver == "string")
		resolver = get(resolverData, resolver);

	// Resolve new resolver
	if (typeof resolver == "function")
		resolver = resolver(args);

	// Special case: if a type is specified and matches the resolver, the
	// resolved value is the same as the resolver
	if (session.type === null || matchType(resolver, session.type, "falseDefault"))
		resolved = inject(resolver, session.default);
	else
		resolved = clone(session.default);

	return resolved;
}

// A getter (leaf) node is defined as an
// object with a getter function at .get
function isGetterNode(candidate) {
	return isObject(candidate) && typeof candidate.get == "function";
}
