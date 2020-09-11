import {
	get,
	set,
	splitPath,
	sym,
	setSymbol,
	clone,
	isEnv,
	isObj,
	isObject,
	coerceToObj,
	alias,
	inject,
	hasOwn,
	isPath,
	mkPath,
	forEach,
	getTime,
	mkStdLib,
	matchType,
	isPrimitive,
	isConstructor
} from "@qtxr/utils";
import { Hookable } from "@qtxr/bc";
import { AssetLoader } from "@qtxr/request";
import { KeyedLinkedList } from "@qtxr/ds";
import URL from "@qtxr/url";
import IETF from "./ietf";
import I18NBranch from "./i18n-branch";

import {
	parseFormat,
	resolveFormat,
	resolveRefTrace,
	mkExpressionEvaluator
} from "./lang";
import langStdLib from "./lang/std-lib";
import customGrammars from "./lang/custom-grammars";
import customOverloads from "./lang/custom-overloads";

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
	EVAL_SYM = sym("meta"),
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
		this.defaultEvaluator = mkExpressionEvaluator(customOverloads);
		this.evaluators = typeof Map == "undefined" ?
			null :
			new Map();

		if (isObject(this.config.loader))
			this.loader = this.config.loader;
		else if (isConstructor(this.config.loader))
			this.loader = mkLoader(this.config.loader, this);
		else
			this.loader = mkLoader(AssetLoader, this);

		if (this.config.sitemapPath) {
			this.loader.prefetch(this.config.sitemapPath, this.config, {
				prefetchResponse: (loader, path, response) => {
					if (!response.success)
						return;

					this.sitemap = response.payload;

					for (const k in this.sitemap) {
						if (!hasOwn(this.sitemap, k))
							continue;

						this.sitemap[k] = this.sitemap[k]
							.map(s => new IETF(s));
					}
				}
			});
		}
	}

	// Config
	setOverloads(overloads) {
		this.defaultEvaluator = mkExpressionEvaluator(overloads);
		return this.defaultEvaluator;
	}

	// Retrieval
	get(accessor, locale = null, copy = false) {
		const partition = this.getPartition(locale),
			gotten = get(
				partition,
				accessor,
				NULL_GET
			);

		return copy ? clone(gotten) : gotten;
	}

	getOr(accessor, locale = null, copy = false) {
		return (fallback = null) => {
			const partition = this.getPartition(locale);
			let gotten = get(
				partition,
				accessor,
				NULL_GET
			);

			if (gotten == NULL_GET)
				gotten = fallback;

			return copy ? clone(gotten) : gotten;
		};
	}

	getOfType(accessor, type, locale = null, copy = false) {
		return (fallback = null) => {
			const partition = this.getPartition(locale);
			let gotten = get(
				partition,
				accessor,
				NULL_GET
			);

			if (!matchType(gotten, type))
				gotten = fallback;

			return copy ? clone(gotten) : gotten;
		};
	}

	format(format, vars = null, locale = null, baseStore = {}, overloads = null) {
		return this._format("", format, vars, locale, baseStore, overloads);
	}

	_format(baseAccessor, format, vars = null, locale = null, baseStore = {}, overloads = null) {
		locale = IETF.coerce(locale);
		locale = locale.valid ? locale : this.locale;
		vars = vars == null ?
			null :
			(isObject(vars) ? vars : { x: vars });

		const parseMeta = {
			customGrammars
		};

		const meta = {
			locale,
			parseMeta,
			store: new this.stdLib(baseStore, vars),
			manager: this,
			formatTrace: null,
			parsedFormat: null,
			evaluator: null,
			context: null,
			token: null,
			args: []
		};

		const partition = this.getPartition(locale);
		let formatTrace = null,
			outFormat = format;

		if (isPath(format)) {
			if (baseAccessor) {
				formatTrace = resolveRefTrace(
					partition,
					splitPath(mkPath(baseAccessor, format)),
					meta
				);
			} else {
				formatTrace = resolveRefTrace(
					partition,
					splitPath(format),
					meta
				);
			}

			outFormat = formatTrace.data;
		}

		if (!formatTrace || formatTrace.data === undefined || typeof formatTrace.data != "string") {
			formatTrace = resolveRefTrace(partition, baseAccessor, meta);
			outFormat = format;
		}

		const parsedFormat = parseFormat(outFormat, {
			customGrammars
		});
		meta.formatTrace = formatTrace;
		meta.parsedFormat = parsedFormat;

		let evaluator = this.evaluators ?
			this.evaluators.get(overloads) :
			overloads && overloads[EVAL_SYM];

		if (!evaluator && overloads) {
			evaluator = mkExpressionEvaluator(overloads);

			if (this.evaluators)
				this.evaluators.set(overloads, evaluator);
			else
				setSymbol(overloads, EVAL_SYM, evaluator);
		}

		meta.evaluator = evaluator || this.defaultEvaluator;
		return resolveFormat(parsedFormat, meta);
	}

	dateFormat(format, vars = null, date = null, locale = null, overloads = null) {
		return this._dateFormat("", format, vars, date, locale, overloads);
	}

	_dateFormat(path, format, vars = null, date = null, locale = null, overloads = null) {
		if (typeof date == "string" || (typeof date == "number" && !isNaN(date)))
			date = new Date(date);
		if (!(date instanceof Date) || isNaN(date.valueOf()))
			date = new Date();

		return this._format(path, format, vars, locale, {
			date
		}, overloads);
	}

	interpolate(accessor, ...args) {
		let str = this.get(accessor);

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

	// Fetching
	setLocale(locale, config = null, lazy = true) {
		locale = IETF.coerce(locale);
		this.requestedLocale = locale;

		return this.fetch(null, locale, config, lazy)
			.then(partition => {
				const oldLocale = this.locale;

				if (!partition)
					return false;
				
				this.locale = locale;
				this.callHooks("localeset", locale);

				if (!locale.equals(oldLocale))
					this.callHooks("localechange", locale, oldLocale);

				return true;
			});
	}

	loadLocale(locale, config = null, lazy = true) {
		locale = IETF.coerce(locale);

		return this.fetch(null, locale, config, lazy)
			.then(partition => Boolean(partition));
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
			inData;
		const name = payload.name || payload.path,
			path = payload.path || "";

		if (!isObj(payload))
			return err(`Failed to supply data for '${locale.value}' at '${path}' as '${name}' because the supplied data is not an object`);

		if (payload.locale)
			locale = IETF.coerce(payload.locale);

		if (payload.isAssetNode) {
			dependencies = payload.dependencies;
			inData = payload.item;
		} else {
			if (!name || typeof name != "string")
				return err(`Failed to supply data for '${locale.value}' because the supplied data doesn't have a valid identifying name or path`);

			dependencies = [];

			if (path) {
				inData = {};
				set(inData, path, payload.data);
			} else
				inData = payload.data;
		}

		if (!isObj(inData))
			return err(`Failed to supply data for '${locale.value}' at '${path}' as '${name}' because the supplied data is not an object`);
		if (!locale.valid)
			return err(`Failed to supply data for '${locale.value}' at '${path}' as '${name}' because the IETF language tag is invalid`);
		if (hasOwn(this.addedAssets, name) && !force)
			return err(`Refused to supply data for '${locale.value}' at '${path}' as '${name}' because there is data defined by that name. Use the force flag`);

		const newLocale = !hasOwn(this.store, locale.value),
			startTime = getTime();
		let partition = this.store[locale.value];

		if (newLocale) {
			partition = coerceToObj(null, inData);
			setSymbol(partition, META_SYM, {
				name,
				path,
				dependencies,
				suppliedBy: {},
				supplyTime: 0
			});
			this.locales.push(locale);
			this.store[locale.value] = partition;

			for (let i = 0, l = this.localePartitions.length; i < l; i++) {
				supplyLocaleData(partition, this.localePartitions[i], this.locales[i], locale);
				partition[META_SYM].suppliedBy[this.localePartitions[i][META_SYM].name] = true;
			}

			this.localePartitions.push(partition);
		}

		supplyLocaleData(partition, inData, locale, locale);

		for (let i = 0, l = this.localePartitions.length; i < l; i++) {
			const part = this.localePartitions[i],
				meta = part[META_SYM];

			if (part != partition && (force || !hasOwn(meta.suppliedBy, name))) {
				supplyLocaleData(part, partition, locale, this.locales[i]);
				meta.suppliedBy[name] = true;
			}
		}

		partition[META_SYM].supplyTime += (getTime() - startTime);
		this.addedAssets[name] = inData;
		return partition;
	}

	// Branching
	branch(path = "") {
		return new I18NBranch(this, path);
	}

	// Utilities
	isEmpty(value) {
		return value == NULL_GET;
	}

	static setDefaultConfig(config) {
		inject(I18NManager.DEF_CONFIG, config, "override");
	}

	static isEmpty(value) {
		return value == NULL_GET;
	}
}

alias(I18NManager.prototype, {
	format: ["fmt", "compose"],
	dateFormat: ["dfmt", "dateCompose"]
});

function mkLoader(constr, inst) {
	return new constr({
		path: (loader, path) => normalizeFilename(path, inst),
		fetchResponse: (loader, path, response) => {
			if (!response)
				console.error(`Failed to load locale data at ${path}`);

			return response;
		},
		xhrSettings: (loader, path, settings) => {
			return Object.assign({
				baseUrl: resolveBaseUrl(inst.config.baseUrl)
			}, settings);
		},
		dependencies: (loader, path, dependent) => {
			const dependencies = [];

			switch (get(inst.config, "files.structure")) {
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

				switch (get(inst.config, "files.structure")) {
					case "file": {
						const stripped = stripExtension(path),
							ex = /\.?([^.]+?)$/.exec(stripped);

						if (ex)
							locale = new IETF(ex[1]);
						break;
					}

					case "dir": {
						const baseUrl = resolveBaseUrl(inst.config.baseUrl),
							fullPath = URL.join(baseUrl, path),
							relativePath = fullPath.indexOf(baseUrl) == 0 ?
								fullPath.substring(baseUrl.length) :
								fullPath,
							ex = /[\\/.]+([a-z0-9-]+)/i.exec(relativePath);

						if (ex)
							locale = new IETF(ex[1]);
						break;
					}
				}

				node.locale = locale && locale.valid ? locale : null;
			}
		}
	});
}

function supplyLocaleData(partition, data, locale, targetLocale) {
	const similarity = IETF.compare(locale, targetLocale);

	const supply = (part, d) => {
		let map;

		if (!hasOwn(part, OWNER_MAP_SYM)) {
			map = new KeyedLinkedList();
			setSymbol(part, OWNER_MAP_SYM, map);
		} else
			map = part[OWNER_MAP_SYM];

		if (hasOwn(d, OWNER_MAP_SYM))
			d[OWNER_MAP_SYM].forEach((ls, k) => inj(part, map, d[k], k));
		else
			forEach(d, (v, k) => inj(part, map, v, k));
	};

	const inj = (part, map, v, k) => {
		if (hasOwn(RESERVED_KEYS, k))
			return;

		if (map.has(k)) {
			if (isPrimitive(v)) {
				const ls = map.get(k);

				if (similarity >= ls[1]) {
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

function err(retVal, msg) {
	if (!msg) {
		msg = retVal;
		retVal = null;
	}

	console.error(msg);
	return retVal;
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
