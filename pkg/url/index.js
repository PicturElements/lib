const pathComponentClassifiers = {
		".": null,
		"..": "upDir",
		"/": null
	},
	// Capturing groups:
	// 1: Protocol (definitely domain)
	// 2: period-separated part (signifies file extension or domain)
	// 3: Port (definitely domain)
	// 4: Characters continuing the URL after the domain
	domainRegex = /^(https?:\/\/)?(?:[^.:\\/\s]+?|\\.)((?:\.(?:[^.:\\/\s]+?|\\.)+)*)(:\d{1,5})?(?=(\/)|$)/,
	queryRegex = /\?([^#]+)/,
	querySplitRegex = /(\w+)(?:&|$|=((?:[^\\&=]+|\\.)+))/g,
	hashRegex = /#([^?]+)/,
	absoluteRegex = /^(?:\/|https?:\/\/)/;

export default class URL {
	constructor(url, noParse) {
		this.valid = true;
		this.error = null;
		this.domain = "";
		this.path = [];
		this.query = "";
		this.queryDict = {};
		this.hash = "";
		this.raw = null;
		this.source = url;
		this.absolute = false;
		this.stepUp = 0;

		if (!noParse) {
			const parsed = parseUrl(url);

			if (parsed.valid)
				URL.cache[url] = this;
			else
				sendError(`Invalid URL '${url}'. Error: ${parsed.error}`);

			Object.assign(this, parsed);
		}

		this.applyProperties();
	}

	clone() {
		const cloned = new URL(null, true);

		for (const k in this) {
			if (!this.hasOwnProperty(k))
				continue;

			const item = this[k];
			
			if (Array.isArray(item))
				cloned[k] = item.slice();
			else if (item && typeof item == "object")
				cloned[k] = Object.assign({}, item);
			else
				cloned[k] = item;
		}

		return cloned;
	}

	// Generate additional data from 
	applyProperties(tasks = {}) {
		for (const k in tasks) {
			if (!tasks.hasOwnProperty(k))
				continue;

			const instruction = tasks[k];

			switch (k) {
				case "setQuery":
					this.query = typeof instruction == "string" ? instruction : this.query;
					this.queryDict = dictFromQuery(this.query);
					break;
				case "setQueryDict":
					this.queryDict = instruction;
					this.query = queryFromDict(this.queryDict);
					break;
				case "setHash":
					this.hash = instruction || null;
					break;
			}
		}

		const source = this.source;
		this.absolute = (this.stepUp == 0 && Boolean(this.domain)) || (typeof source == "string" && absoluteRegex.test(source));

		const path = this.path;
		let raw = this.domain;

		for (let i = 0, l = path.length; i < l; i++) {
			if (i > 0 || this.absolute)
				raw += "/";

			raw += path[i].value;
		}

		if (this.query)
			raw += `?${this.query}`;
		if (this.hash)
			raw += `#${this.hash}`;

		this.raw = raw;
	}

	join(...paths) {
		return URL.jn(this, ...paths).str();
	}

	jn(...paths) {
		return URL.jn(this, ...paths);
	}

	str() {
		return this.raw;
	}

	toString() {
		return this.raw;
	}

	static isAbsolute(url) {
		return coerceUrl(url);
	}

	static join(...paths) {
		return URL.jn(...paths).str();
	}

	static jn(...paths) {
		let outInstance = null,
			path = [],
			hash = "";
		const queryDict = {};

		// Validate / collect data 
		for (let i = 0, l = paths.length; i < l; i++) {
			const url = coerceUrl(paths[i]);

			if (!url.valid) {
				sendError("Cannot join path: invalid component");
				return URL.NULL;
			}

			if (url.absolute && i > 0) {
				sendError(`Cannot join path: interspersed absolute path '${url.raw}'`);
				return URL.NULL;
			}

			if (!outInstance)
				outInstance = url.clone();

			paths[i] = url;

			if (url.hash)
				hash = url.hash;
			Object.assign(queryDict, url.queryDict);
		}

		if (!outInstance)
			return URL.NULL;

		for (let i = 0, l = paths.length; i < l; i++) {
			const p = paths[i].path;

			for (let j = 0, l2 = p.length; j < l2; j++)
				path.push(p[j]);
		}

		// Inject some specific information from the first path section
		// not specifically involved in the join
		const firstPath = paths[0];
		outInstance.absolute = firstPath.absolute;
		outInstance.domain = firstPath.domain;
		outInstance.source = firstPath.source;

		outInstance.path = path;
		collapsePath(outInstance);
		outInstance.applyProperties({
			setQueryDict: queryDict,
			setHash: hash
		});
		outInstance.source = outInstance.raw;

		return outInstance;
	}
}

URL.cache = {};
URL.throw = false;
URL.NULL = new URL("");

function parseUrl(url) {
	const pathRegex = /\/|(?:[^\\/\s]+?|\\.)+|\.{1,2}/g, // /\/|(\.?(?:[^.\\/\s]+?|\\.)+)+|\.{1,2}/g,
		payload = {
			valid: true,
			error: null,
			domain: "",
			path: [],
			query: "",
			queryDict: {},
			hash: "",
			stepUp: 0
		};

	if (typeof url != "string") {
		payload.valid = false;
		payload.error = "Supplied URL is not a string";
		return payload;
	}

	const domainEx = domainRegex.exec(url);
	// If protocol or port exists, or there are valid characters
	// after a file-like substring, treat as domain
	if (domainEx && (domainEx[1] || domainEx[3] || (domainEx[2] && domainEx[4]))) {
		payload.domain = domainEx[0];
		url = url.substr(domainEx[0].length);
	}

	const queryEx = queryRegex.exec(url);
	if (queryEx) {
		const qs = queryEx[1];
		payload.query = qs;
		payload.queryDict = dictFromQuery(qs);
		url = url.replace(queryRegex, "");
	}

	const hashEx = hashRegex.exec(url);
	if (hashEx) {
		payload.hash = hashEx[1];
		url = url.replace(hashRegex, "");
	}

	const path = [];
	let idx = 0;

	while (true) {
		const ex = pathRegex.exec(url);
		if (!ex || ex.index != idx)
			break;

		const match = ex[0];

		if (pathComponentClassifiers.hasOwnProperty(match)) {
			const classifier = pathComponentClassifiers[match];

			if (classifier)
				path.push(mkPathComponent(classifier, match));
		} else
			path.push(mkPathComponent("component", match));

		idx += ex[0].length;
	}

	if (idx != url.length) {
		payload.valid = false;
		payload.error = "Path contains invalid characters";
		return payload;
	}

	payload.path = path;

	collapsePath(payload);
	return payload;
}

function mkPathComponent(type, value) {
	return {
		type,
		value
	};
}

function collapsePath(payload) {
	const path = payload.path;
	let stepUp = 0;

	for (let i = path.length - 1; i >= 0; i--) {
		switch (path[i].type) {
			case "upDir":
				stepUp++;
				path.splice(i, 1);
				break;
			case "component":
				if (stepUp) {
					path.splice(i, 1);
					stepUp--;
				}
				break;
		}
	}

	if (stepUp && payload.absolute !== true) {
		const pad = repeatPathComponent("upDir", "..", stepUp);
		payload.path = pad.concat(path);
		payload.stepUp = stepUp;
	}

	return payload;
}

function repeatPathComponent(type, value, count) {
	const out = [];

	while (count--)
		out.push(mkPathComponent(type, value));

	return out;
}

function coerceUrl(url) {
	if (url instanceof URL)
		return url;

	if (URL.cache.hasOwnProperty(url))
		return URL.cache[url];

	return new URL(url);
}

function sendError(msg) {
	if (URL.throw)
		throw new Error(msg);
	
	console.error(msg);
}

// Generating functions
function queryFromDict(dict) {
	let query = "";

	for (const k in dict) {
		if (!dict.hasOwnProperty(k))
			continue;

		if (query)
			query += "&";

		query += k;

		if (dict[k] !== undefined)
			query += `=${dict[k]}`;
	}

	return query;
}

function dictFromQuery(query) {
	const queryDict = {};

	while (true) {
		const kvPair = querySplitRegex.exec(query);
		if (!kvPair)
			break;

		queryDict[kvPair[1]] = kvPair[2];
	}

	return queryDict;
}
