import {
	hasOwn,
	parseStr,
	isObject,
	spliceStr,
	findClosest
} from "@qtxr/utils";

const weakmapSupported = typeof WeakMap != "undefined",
	URL_MAP = weakmapSupported ? new WeakMap() : {
		map: {},
		set(value, inst) {
			this.map[inst._uid] = value;
			return this;
		},
		get(inst) {
			return this.map[inst._uid];
		},
		has(inst) {
			return hasOwn(this.map, inst._uid);
		},
		delete(inst) {
			return this.has(inst) ? delete this.map[inst._uid] : false;
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
		regex: /^[^/:]+/
	}, {
		key: "port",
		guard(inst, otomy) {
			return Boolean(inst.hostname);
		},
		regex: /^:([^\s/]+)/,
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

const searchSplitRegex = /(\w+)(?:&|$|=((?:[^\\&=]+|\\.)*))/g;
const INVALID_PARAM_TYPES = {
	symbol: true,
	function: true,
	object: true
};

class SearchParams {
	constructor(input) {
		this.params = [];
		this.map = {};
		this.plain = {};
		this.string = "";
		this.size = 0;
		this._order = 0;

		if (input)
			this.parse(input);
	}

	_getIdxByOrder(order) {
		const result = findClosest(this.params, v => v.order - order);
		if (!result.exact)
			return -1;

		return result.index;
	}

	_recalcStr(tail = false) {
		const len = this.params.length;
		let str = tail ? this.string : "";

		for (let i = tail ? len - 1 : 0; i < len; i++) {
			const item = this.params[i];
			str += ((str ? "&" : "?") + encodeURIComponent(item.key));

			if (item.value !== undefined)
				str += `=${encodeURIComponent(item.value)}`;
		}

		this.string = str;
	}

	_isInvalidType(value) {
		return value !== null && hasOwn(INVALID_PARAM_TYPES, typeof value);
	}

	set(key, value) {
		if (typeof key != "string" || this._isInvalidType(value))
			return this;

		if (typeof value == "string")
			value = decodeURIComponent(value);

		if (this.has(key)) {
			this.map[key].value = value;
			this.plain[key] = value;
			this._recalcStr();
		} else {
			const item = {
				key,
				value,
				order: this._order++
			};

			this.params.push(item);
			this.map[key] = item;
			this.plain[key] = value;
			this.size++;
			this._recalcStr(true);
		}

		return this;
	}

	delete(key) {
		if (!this.has(key))
			return false;

		const idx = this._getIdxByOrder(this.map[key].order);
		this.params.splice(idx, 1);
		this.size--;
		this._recalcStr();
		delete this.map[key];
		delete this.plain[key];

		return true;
	}

	has(key) {
		return typeof key == "string" && hasOwn(this.map, key);
	}

	get(key) {
		if (this.has(key))
			return this.map[key].value;
	}

	clear() {
		this.params = [];
		this.map = {};
		this.plain = {};
		this.string = "";
		this.size = 0;
	}

	parse(input) {
		this.clear();

		if (!input)
			return this;

		if (typeof input == "string") {
			input = decodeURIComponent(input);

			while (true) {
				const kvPair = searchSplitRegex.exec(input);
				if (!kvPair)
					break;

				let value = parseStr(kvPair[2]);
				if (this._isInvalidType(value))
					value = kvPair[2];

				this.set(kvPair[1], value);
			}
		} else if (isObject(input)) {
			for (const k in input) {
				if (hasOwn(input, k))
					this.set(k, input[k]);
			}
		}

		return this;
	}

	assign(input) {
		return this.parse(input);
	}

	clone() {
		const cloned = new SearchParams();
		cloned.string = this.string;
		cloned.size = this.size;

		for (let i = 0; i < this.size; i++) {
			const item = Object.assign({}, this.params[i]);
			cloned.params.push(item);
			cloned.map[item.key] = item;
			cloned.plain[item.key] = item;
		}

		return cloned;
	}

	forEach(callback) {
		if (typeof callback != "function")
			return false;

		for (let i = 0; i < this.size; i++)
			callback(this.params[i].value, this.params[i].key, this);

		return true;
	}
}

let uid = 0;

export default class URL {
	constructor(url) {
		if (!weakmapSupported) {
			Object.defineProperty(this, "_uid", {
				value: uid++
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
			searchParams: new SearchParams(),
			stepUp: 0,
			pathnameIsRelative: true
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

		const split = host.split(":"),
			data = URL_MAP.get(this);

		data.hostname = split[0].trim();
		data.port = split.length > 1 ? split[1].trim() : "";
	}

	get hostname() {
		return URL_MAP.get(this).hostname;
	}

	set hostname(hostname) {
		hostname = coerceStr(hostname);

		const split = hostname.split(":"),
			data = URL_MAP.get(this),
			trimmedPort = split[1] && split[1].trim();

		data.hostname = split[0].trim();

		if (trimmedPort)
			data.port = trimmedPort;
	}

	get href() {
		const data = URL_MAP.get(this);
		let href = this.origin;

		href += this.pathname;
		
		if (data.searchParams.string)
			href += data.searchParams.string;

		if (data.hash)
			href += data.hash;

		return href;
	}

	set href(url) {
		this.parse(url);
	}

	get origin() {
		const data = URL_MAP.get(this);

		if (data.hostname) {
			const data = URL_MAP.get(this);
			let origin = "";

			if (data.protocol)
				origin += `${data.protocol}//`;

			origin += data.hostname;

			if (data.port)
				origin += `:${data.port}`;

			return origin;
		}

		return "";
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
			pathname += (!i && !data.hostname && (data.pathnameIsRelative || data.stepUp != 0)) ? val : `/${val}`;
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
		if (typeof port == "number" && !isNaN(port) && isFinite(port))
			port = String(port);
		
		URL_MAP.get(this).port = coerceStr(port);
	}

	get protocol() {
		return URL_MAP.get(this).protocol;
	}

	set protocol(protocol) {
		protocol = coerceStr(protocol);
		protocol = protocol && protocol.replace(/:\/*$/, "");
		URL_MAP.get(this).protocol = protocol ? `${protocol}:` : "";
	}

	get search() {
		return URL_MAP.get(this).searchParams.string;
	}

	set search(search) {
		URL_MAP.get(this).searchParams.parse(coerceStr(search));
	}

	get searchParams() {
		return URL_MAP.get(this).searchParams;
	}

	set searchParams(params) {
		URL_MAP.get(this).searchParams.parse(params);
	}

	get query() {
		return URL_MAP.get(this).searchParams.plain;
	}

	set query(params) {
		URL_MAP.get(this).searchParams.parse(params);
	}

	get relative() {
		const data = URL_MAP.get(this);
		return !data.hostname;
	}

	clone() {
		const cloned = new URL(null),
			tData = URL_MAP.get(this),
			cData = URL_MAP.get(cloned);

		Object.assign(cData, tData);
		cData.path = tData.path
			.slice()
			.map(v => Object.assign({}, v));
		cData.searchParams = tData.searchParams.clone();

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

			if (i > 0 && isAbsolute(url)) {
				sendError(`Cannot join path: found interspersed absolute path '${url.href}'`);
				return URL.NULL;
			}

			if (!outInstance)
				outInstance = url.clone();

			paths[i] = url;

			if (url.hash)
				hash = url.hash;
			
			Object.assign(searchParams, url.query);
		}

		if (!outInstance)
			return URL.NULL;

		// Join paths
		for (let i = 0, l = paths.length; i < l; i++) {
			const p = URL_MAP.get(paths[i]).path;

			if (isAbsolute(paths[i]) && paths[i + 1] && !URL_MAP.get(paths[i + 1]).pathnameIsRelative)
				continue;

			for (let j = 0, l2 = p.length; j < l2; j++)
				path.push(p[j]);
		}

		const collapsed = collapsePath(path, outInstance),
			outData = URL_MAP.get(outInstance);

		outData.path = collapsed.path;
		outData.stepUp = collapsed.stepUp;
		outData.hash = hash;
		outData.searchParams.assign(searchParams);

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
		rest: spliceStr(str, ex.index, ex.index + ex[0].length)
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

		if (hasOwn(pathComponentClassifiers, component)) {
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

	if (hasOwn(URL.cache, url))
		return URL.cache[url];

	return new URL(url);
}

function sendError(msg) {
	if (URL.throw)
		throw new Error(msg);
	
	console.error(msg);
}

export {
	SearchParams
};
