import {
	get,
	splitPath,
	sym,
	setSymbol,
	clone,
	isEnv,
	isObj,
	isObject,
	coerceToObj,
	inject,
	hasOwn,
	forEach,
	getTime,
	mkStdLib,
	isPrimitive
} from "@qtxr/utils";
import { Hookable } from "@qtxr/bc";
import { AssetLoader } from "@qtxr/request";
import { KeyedLinkedList } from "@qtxr/ds";
import URL from "@qtxr/url";
import IETF from "./ietf";
import {
	parseFormat,
	resolveFormat,
	resolveRefTrace
} from "./lang";
import langStdLib from "./lang-std-lib";

const RESERVED_KEYS = {
	default: true,
	requires: true,
	extends: true,
	locale: true
};

const NULL_GET = Object.freeze({
	_empty: true
});

const OWNER_MAP_SYM = sym("owner map"),
	META_SYM = sym("meta"),
	EXTENSION_REGEX = /\.([mc]js|js(?:on))/;

class I18NManager extends Hookable {
	constructor(locale, config) {
		if (isObject(locale)) {
			config = locale;
			locale = null;
		}

		super();
		this.locale = locale ?
			IETF.coerce(locale) :
			new IETF("en");
		this.requestedLocale = this.locale;
		this.locales = [];
		this.localePartitions = [];
		this.config = inject(
			I18NManager.DEF_CONFIG,
			config,
			"cloneTarget|override"
		);
		this.store = {};
		this.addedAssets = {};
		this.sitemap = null;
		this.stdLib = mkStdLib(
			"I18NStdLib",
			langStdLib,
			this.config.stdLib
		);

		this.loader = new AssetLoader({
			path: (loader, path) => normalizeFilename(path, this),
			fetchResponse: (loader, path, response) => {
				if (!response)
					console.error(`Failed to load locale data at ${path}`);

				return response;
			},
			xhrSettings: (loader, path, settings) => {
				return Object.assign({
					baseUrl: resolveBaseUrl(this.config.baseUrl)
				}, settings);
			},
			dependencies: (loader, path, dependent) => {
				const dependencies = [];

				switch (get(this.config, "files.structure")) {
					case "file":
						if (dependent.payload.extends)
							dependencies.push(URL.join(path, "..", dependent.payload.extends));
						break;

					case "dir":
						if (dependent.payload.extends)
							dependencies.push(`${dependent.payload.extends}/index`);
						break;
				}

				const requires = dependent.payload.requires,
					newDependencies = requires ?
						(Array.isArray(requires) ?
							requires :
							[requires]) :
						[];

				for (let i = 0, l = newDependencies.length; i < l; i++)
					dependencies.push(URL.join(path, "..", newDependencies[i]));
				
				return dependencies;
			},
			assetNode: (loader, path, node, dependent) => {
				if (node.item && node.item.locale)
					node.locale = node.item.locale;
				else {
					let locale = null;

					switch (get(this.config, "files.structure")) {
						case "file": {
							const stripped = stripExtension(path),
								ex = /\.?([^.]+?)$/.exec(stripped);
							
							if (ex)
								locale = new IETF(ex[1]);
							break;
						}
	
						case "dir": {
							const baseUrl = resolveBaseUrl(this.config.baseUrl),
								fullPath = URL.join(baseUrl, path),
								relativePath = fullPath.indexOf(baseUrl) == 0 ?
									fullPath.substr(baseUrl.length) :
									fullPath,
								ex = /[\\\/.]+([a-z0-9-]+)/i.exec(relativePath);

							if (ex)
								locale = new IETF(ex[1]);
							break;
						}
					}

					node.locale = locale && locale.valid ? locale : null;
				}
			}
		});

		if (this.config.sitemapPath) {
			this.loader.prefetch(this.config.sitemapPath, this.config, {
				prefetchResponse: (loader, path, response) => {
					if (!response.success)
						return;

					this.sitemap = response.payload;

					for (const k in this.sitemap) {
						if (!hasOwn(this.sitemap, k))
							continue;

						this.sitemap[k] = this.sitemap[k].map(s => new IETF(s));
					}
				}
			});
		}
	}

	get(accessor, locale, copy) {
		const partition = this.getPartition(locale),
			gotten = get(
				partition,
				accessor,
				NULL_GET
			);

		return copy ? clone(gotten) : gotten;
	}

	compose(format, vars, locale, baseStore = {}) {
		locale = IETF.coerce(locale);
		locale = locale.valid ? locale : this.locale;
		vars = vars == null ?
			null :
			(isObject(vars) ? vars : { x: vars });

		const p = splitPath(format),
			partition = this.getPartition(locale);
		let formatTrace = null,
			outFormat = format;
		
		if (typeof format == "string") {
			formatTrace = resolveRefTrace(partition, p);
			outFormat = formatTrace.data;
		}
			
		if (!formatTrace || formatTrace.data === undefined || typeof formatTrace.data != "string") {
			formatTrace = resolveRefTrace(partition, "");
			outFormat = format;
		}
		
		const parsedFormat = parseFormat(outFormat);
		return resolveFormat(parsedFormat, {
			formatTrace,
			parsedFormat,
			store: new this.stdLib(baseStore, vars),
			manager: this,
			locale
		});
	}

	dateCompose(format, vars, date, locale) {
		if (typeof date == "string" || (typeof date == "number" && !isNaN(date)))
			date = new Date(date);
		if (!(date instanceof Date) || isNaN(date.valueOf()))
			date = new Date();

		return this.compose(format, vars, locale, {
			date
		});
	}

	interpolate(key, ...args) {
		let str = this.get(key);
		
		if (typeof str != "string")
			return str;

		for (let i = args.length - 1; i >= 0; i--)
			str = str.replace(new RegExp(`%${i - 1}(?![0-9])`, "g"), args[i]);
		
		return str;
	}

	getPartition(locale) {
		locale = IETF.coerce(locale);
		locale = locale.valid ? locale : this.locale;
		return this.store[locale.value] || this.store[locale.primary] || {};
	}

	setLocale(locale, config = null, lazy = true) {
		locale = IETF.coerce(locale);
		this.requestedLocale = locale;

		this.fetch(null, locale, config, lazy)
			.then(partition => {
				const oldLocale = this.locale;

				if (partition)
					this.locale = locale;

				this.callHooks("localeset");

				if (!locale.equals(oldLocale))
					this.callHooks("localechange");

				return Boolean(partition);
			});
	}

	loadFragment(path, config = null, lazy = true) {
		path = normalizeFilename(path, this);

		return this.loader.requestIdle(_ => {
			return new Promise(resolve => {
				const strippedPath = stripExtension(path);
				let locale = this.requestedLocale;

				if (this.sitemap && hasOwn(this.sitemap, strippedPath))
					locale = IETF.findOptimalLocale(this.requestedLocale, this.sitemap[strippedPath]);

				this.fetch(strippedPath, locale, config, lazy)
					.then(d => {
						this.callHooks("fragmentloaded");
						this.callHooks(`fragmentloaded:${strippedPath}`);
						resolve(d);
					});
			});
		});
	}

	async fetch(path, locale, config = null, lazy = true) {
		locale = IETF.coerce(locale);

		switch (get(this.config, "files.structure")) {
			case "file":
				path = path ?
					`${path}.${locale.toString()}` :
					locale.toString();
				break;

			case "dir":
				path = URL.join(locale.toString(), path || "index");
				break;
		}
		
		path = normalizeFilename(path, this);

		if (lazy && hasOwn(this.addedAssets, path))
			return this.addedAssets[path];

		if (this.loader.isEnqueued(path))
			return null;

		const tree = await this.loader.fetchModule(path, config, lazy);

		if (tree.success && !tree.cached) {
			AssetLoader.traverse(tree.payload, dependent => {
				this.feed(dependent, true);
			});

			this.callHooks("localeloaded");
			return tree.payload.item;
		}

		if (!tree.success)
			console.error(`Failed to load ${path}`);

		return null;
	}

	feed(payload, force = false) {
		force = typeof force == "boolean" ? force : false;

		let locale = IETF.coerce(payload.locale),
			dependencies,
			inData,
			path;

		if (!isObj(payload))
			return console.error(`Failed to register locale '${locale.value}' because the supplied data is not an object`);

		if (payload.locale)
			locale = IETF.coerce(payload.locale);
		
		if (payload.isAssetNode) {
			dependencies = payload.dependencies;
			inData = payload.item;
			path = payload.path;
		} else {
			const pth = payload.path || payload.name;

			if (!pth || typeof pth != "string")
				return console.error(`Failed to register locale '${locale.value}' because the supplied data doesn't have a valid identifying name or path`);

			dependencies = [];
			inData = payload.data;
			path = pth;
		}

		if (!isObj(inData))
			return console.error(`Failed to register locale '${locale.value}' because the supplied data is not an object`);
		if (!locale.valid)
			return console.error(`Failed to register locale '${locale.value}' because the IETF language tag is invalid`);
		if (hasOwn(this.addedAssets, path) && !force)
			return console.error(`Refused to add locale '${locale.value}' because it's already defined. Use the force flag`);

		const newLocale = !hasOwn(this.store, locale.value),
			startTime = getTime();
		let partition = this.store[locale.value];

		if (newLocale) {
			partition = coerceToObj(null, inData);
			partition[META_SYM] = {
				path,
				dependencies,
				suppliedBy: {},
				supplyTime: 0
			};
			this.locales.push(locale);
			this.store[locale.value] = partition;

			for (let i = 0, l = this.localePartitions.length; i < l; i++) {
				supplyLocaleData(partition, this.localePartitions[i], this.locales[i], locale);
				partition[META_SYM].suppliedBy[this.localePartitions[i][META_SYM].path] = true;
			}

			this.localePartitions.push(partition);
		}

		supplyLocaleData(partition, inData, locale, locale);

		for (let i = 0, l = this.localePartitions.length; i < l; i++) {
			const part = this.localePartitions[i],
				meta = part[META_SYM];

			if (part != partition && (!hasOwn(meta.suppliedBy, path) || force)) {
				supplyLocaleData(part, partition, locale, this.locales[i]);
				meta.suppliedBy[path] = true;
			}
		}

		partition[META_SYM].supplyTime += (getTime() - startTime);
		this.addedAssets[path] = inData;
	}

	static setDefaultConfig(config) {
		inject(I18NManager.DEF_CONFIG, config, "override");
	}
}

I18NManager.prototype.format = I18NManager.prototype.compose;
I18NManager.prototype.fmt = I18NManager.prototype.compose;
I18NManager.prototype.dateFormat = I18NManager.prototype.dateCompose;
I18NManager.prototype.dfmt = I18NManager.prototype.dateCompose;

function supplyLocaleData(partition, data, locale, targetLocale) {
	const similarity = IETF.compare(locale, targetLocale);

	const supply = (part, d) => {
		let map;

		if (!hasOwn(part, OWNER_MAP_SYM, true)) {
			map = new KeyedLinkedList();
			setSymbol(part, OWNER_MAP_SYM, map);
		} else
			map = part[OWNER_MAP_SYM];

		if (hasOwn(d, OWNER_MAP_SYM, true))
			d[OWNER_MAP_SYM].forEach((ls, k) => inj(part, map, d[k], k));
		else
			forEach(d, (v, k) => inj(part, map, v, k));
	};

	const inj = (part, map, v, k) => {
		if (hasOwn(RESERVED_KEYS, k))
			return;

		if (map.has(k)) {
			if (isPrimitive(v)) {
				const ls = map.get(k).value;

				if (similarity > ls[1]) {
					part[k] = v;
					map.push(k, [locale, similarity]);
				}
			} else
				supply(part[k], v);
		} else {
			if (isPrimitive(v))
				part[k] = v;
			else {
				part[k] = coerceToObj(null, v);
				supply(part[k], v);
			}

			map.push(k, [locale, similarity]);
		}
	};

	supply(partition, data);
}

function normalizeFilename(path, manager) {
	if (EXTENSION_REGEX.test(path))
		return path;

	return `${path}.${get(manager.config, "files.defaultExtension", "json")}`;
}

function stripExtension(path) {
	return path.replace(/\.\w+?$/, "");
}

function resolveBaseUrl(baseUrl) {
	if (isObject(baseUrl)) {
		for (const k in baseUrl) {
			if (!hasOwn(baseUrl, k))
				continue;

			if (isEnv(k))
				return baseUrl[k];
		}

		if (typeof baseUrl != "string")
			return this.config.baseUrl.default || "/";
	}

	return baseUrl;
}

I18NManager.DEF_CONFIG = {
	baseUrl: isEnv("production") ?
		"/dist/text" :
		"/text",
	sitemapPath: "sitemap",
	files: {
		structure: "file",
		defaultExtension: "json"
	}
};

export default I18NManager;
