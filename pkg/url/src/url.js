const weakmapSupported = typeof WeakMap != "undefined",
	URL_MAP = weakmapSupported ? new WeakMap() : {
		map: {},
		set(value, inst) {
			this.map[inst._uuid] = value;
			return this;
		},
		get(inst) {
			return this.map[inst._uuid];
		},
		has(inst) {
			return this.map.hasOwnProperty(inst._uuid);
		},
		delete(inst) {
			return this.has(inst) ? delete this.map[inst._uuid] : false;
		}
	};

const URL_PARSERS = [
	{
		key: "protocol",
		regex: /^([^\s]+?:)\/\//,
		capture: 1
	}, {
		key: "hostname",
		guard(inst, otomy) {
			return Boolean(inst.protocol);
		},
		regex: /^[^\/]+/
	}, {
		key: "port",
		regex: /^:([^\s\/]+)/,
		capture: 1
	}, {
		key: "pathname",
		regex: /^[^?#]+/
	}, {
		key: "search",
		regex: /\?[^#]+/
	}, {
		key: "hash",
		regex: /#[^?]+/
	}
];

const INVALID_PARAM_TYPES = {
	symbol: true,
	function: true,
	object: true,
	undefined: true
};

let uuid = 0;

export default class URL {
	constructor(url) {
		if (!weakmapSupported) {
			Object.defineProperty(this, "_uuid", {
				value: uuid++
			});
		}

		URL_MAP.set(this, {
			hash: "",
			hostname: "",
			href: "",
			origin: "",
			path: [],
			pathname: "",
			port: "",
			protocol: "",
			search: "",
			searchParams: {},
			stepUp: 0,
			pathnameIsRelative: false
		});

		if (url)
			this.parse(url);
	}

	get hash() {
		return URL_MAP.get(this).hash;
	}

	set hash(hash) {
		hash = coerceStr(hash);
		if (hash && hash[0] != "#")
			hash = `#${hash}`;

		URL_MAP.get(this).hash = hash;
	}

	get host() {
		const data = URL_MAP.get(this);
		return data.port ? `${data.hostname}:${data.port}` : data.hostname;
	}

	set host(host) {
		host = coerceStr(host);
		const split = host.split(":");

		this.hostname = split[0];
		if (split.length > 1)
			this.port = split[1];
	}

	get hostname() {
		return URL_MAP.get(this).hostname;
	}

	set hostname(hostname) {
		URL_MAP.get(this).hostname = coerceStr(hostname);
	}

	get href() {
		const data = URL_MAP.get(this);
		let href = "";

		if (data.protocol)
			href += `${data.protocol}//`;

		href += (data.hostname + this.pathname);
		
		if (data.search)
			href += data.search;

		if (data.hash)
			href += data.hash;

		return href;
	}

	set href(url) {
		this.parse(url);
	}

	get origin() {
		return "not implemented";
		// return URL_MAP.get(this).origin;
	}

	set origin(origin) {
		console.warn("origin is read-only");
	}

	get pathname() {
		const data = URL_MAP.get(this),
			path = data.path;
		let pathname = "";

		for (let i = 0, l = path.length; i < l; i++) {
			const val = path[i].value;
			pathname += (!i && (data.pathnameIsRelative || data.stepUp != 0)) ? val : `/${val}`;
		}

		return pathname;
	}

	set pathname(pathname) {
		const data = URL_MAP.get(this),
			path = parsePath(coerceStr(pathname)),
			collapsed = collapsePath(path, data);

		data.pathnameIsRelative = pathname[0] != "/";
		data.stepUp = collapsed.stepUp;
		data.path = collapsed.path;
	}

	get port() {
		return URL_MAP.get(this).port;
	}

	set port(port) {
		URL_MAP.get(this).port = coerceStr(port);
	}

	get protocol() {
		return URL_MAP.get(this).protocol;
	}

	set protocol(protocol) {
		protocol = coerceStr(protocol);
		if (protocol && protocol[protocol.length - 1] != ":")
			protocol = `${protocol}:`;

		URL_MAP.get(this).protocol = protocol;
	}

	get search() {
		return URL_MAP.get(this).search;
	}

	set search(search) {
		const data = URL_MAP.get(this);
		search = coerceStr(search);
		if (search && search[0] != "?")
			search = `?${search}`;
		
		data.search = search;
		data.searchParams = searchToParams(search);
	}

	get searchParams() {
		return URL_MAP.get(this).searchParams;
	}

	set searchParams(params) {
		const data = URL_MAP.get(this),
			newParams = {};

		if (params && params.constructor == Object) {
			for (const k in params) {
				if (!params.hasOwnProperty(k) || INVALID_PARAM_TYPES.hasOwnProperty(typeof params[k]))
					continue;

				newParams[k] = params[k];
			}

			data.search = paramsToSearch(newParams);
			data.searchParams = newParams;
		} else if (params === null) {
			data.search = paramsToSearch({});
			data.searchParams = {};
		}
	}

	get relative() {
		const data = URL_MAP.get(this);
		return !Boolean(data.hostname);
	}

	clone() {
		const cloned = new URL(null),
			tData = URL_MAP.get(this),
			cData = URL_MAP.get(cloned);

		for (const k in tData) {
			if (!tData.hasOwnProperty(k))
				continue;

			const item = tData[k];
			
			if (Array.isArray(item))
				cData[k] = item.slice().map(v => Object.assign({}, v));
			else if (item && typeof item == "object")
				cData[k] = Object.assign({}, item);
			else
				cData[k] = item;
		}

		return cloned;
	}

	join(...paths) {
		return URL.jn(this, ...paths).str();
	}

	jn(...paths) {
		return URL.jn(this, ...paths);
	}

	str() {
		return this.href;
	}

	toString() {
		return this.href;
	}

	parse(url) {
		url = typeof url == "string" ? url.trim() : "";

		for (let i = 0, l = URL_PARSERS.length; i < l; i++) {
			const parser = URL_PARSERS[i],
				otomy = stringotomy(parser.regex, url, parser.capture);
				
			if (typeof parser.guard == "function" && !parser.guard(this, otomy))
				this[parser.key] = "";
			else {
				this[parser.key] = otomy.extracted;
				url = otomy.rest;
			}
		}
	}

	static join(...paths) {
		return URL.jn(...paths).str();
	}

	static jn(...paths) {
		if (!paths.length)
			return URL.NULL;

		let outInstance = null,
			path = [],
			hash = "";
		const searchParams = {};

		// Validate / collect data 
		for (let i = 0, l = paths.length; i < l; i++) {
			const url = coerceUrl(paths[i]);

			if (i > 0 && isAbsolute(this)) {
				sendError(`Cannot join path: interspersed absolute path '${url.href}'`);
				return URL.NULL;
			}

			if (!outInstance)
				outInstance = url.clone();

			paths[i] = url;

			if (url.hash)
				hash = url.hash;
			
			Object.assign(searchParams, url.searchParams);
		}

		if (!outInstance)
			return URL.NULL;

		// Join paths
		for (let i = 0, l = paths.length; i < l; i++) {
			const p = URL_MAP.get(paths[i]).path;

			for (let j = 0, l2 = p.length; j < l2; j++)
				path.push(p[j]);
		}

		const collapsed = collapsePath(path, outInstance),
			outData = URL_MAP.get(outInstance);

		outData.path = collapsed.path;
		outData.stepUp = collapsed.stepUp;
		outData.search = paramsToSearch(searchParams);
		outData.searchParams = searchParams;
		outData.hash = hash;

		return outInstance;
	}
}

URL.cache = {};
URL.throw = false;
URL.NULL = new URL("");

function coerceStr(val) {
	return encodeURI((typeof val == "string" ? val : "").trim());
}

function stringotomy(regex, str, capture = 0) {
	const ex = regex.exec(str);
	if (!ex) {
		return {
			extracted: "",
			rest: str
		};
	}

	return {
		extracted: ex[capture] || "",
		rest: str.substr(0, ex.index) + str.substr(ex.index + ex[0].length)
	};
}

const pathComponentClassifiers = {
	".": null,
	"..": "upDir",
	"/": null
};

function parsePath(path) {
	path = path.split("/");
	const pathOut = [];

	for (let i = 0, l = path.length; i < l; i++) {
		const component = path[i];
		if (!component)
			continue;

		if (pathComponentClassifiers.hasOwnProperty(component)) {
			const classifier = pathComponentClassifiers[component];
	
			if (classifier)
				pathOut.push(mkPathComponent(classifier, component));
		} else
			pathOut.push(mkPathComponent("component", component));
	}

	return pathOut;
}

function mkPathComponent(type, value) {
	return {
		type,
		value
	};
}

function isAbsolute(dataOrInstance) {
	const data = dataOrInstance instanceof URL ? URL_MAP.get(dataOrInstance) : dataOrInstance;
	return Boolean(data.hostname);
}

function collapsePath(path, dataOrInstance) {
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

	if (stepUp && !isAbsolute(dataOrInstance)) {
		const pad = repeatPathComponent("upDir", "..", stepUp);
		path = pad.concat(path);
	} else
		stepUp = 0;

	return {
		path,
		stepUp
	};
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
function paramsToSearch(dict) {
	let search = "";

	for (const k in dict) {
		if (!dict.hasOwnProperty(k))
			continue;

		if (search)
			search += "&";

		search += k;

		if (dict[k] !== undefined)
			search += `=${dict[k]}`;
	}

	return search ? `?${search}` : "";
}

const searchSplitRegex = /(\w+)(?:&|$|=((?:[^\\&=]+|\\.)+))/g;

function searchToParams(search) {
	const searchDict = {};

	while (true) {
		const kvPair = searchSplitRegex.exec(search);
		if (!kvPair)
			break;

		searchDict[kvPair[1]] = kvPair[2];
	}

	return searchDict;
}
