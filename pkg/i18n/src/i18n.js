import {
	isObj,
	clone,
	splitPath,
	get,
	isObject,
	coerceToObj,
	sym,
	setSymbol
} from "@qtxr/utils";
import Hookable from "@qtxr/bc/hookable";
import AssetLoader from "@qtxr/request/asset-loader";
import IETF, { coerceIETF } from "./ietf";
import {
	parseFormat,
	resolveFormat,
	resolveRefTrace
} from "./lang";
import langStdLib from "./lang-std-lib";

const DEF_I18N_SETTINGS = {
	baseUrl: process.env.NODE_ENV == "production" ? "/dist/text" : "/text",
	sitemapPath: "sitemap"
};

const RESERVED_KEYS = {
	default: 1,
	requires: 1
};

const NULL_GET = Object.freeze({
	_empty: true
});

const LOCALE_SYM = sym("locale"),
	REF_TABLE_SYM = sym("reference table"),
	OWNER_SYM = sym("owner");

class STDLib {
	constructor(lib) {
		this.lib = Object.assign({}, lib);
	}

	add(key, func) {
		if (!key || typeof key != "string")
			return console.warn(`Cannot add STDLib function: ${key} is not a valid key`);

		if (typeof func != "function")
			return console.warn("Cannot add STDLib function: no function supplied");

		this.lib[key] = func;
	}

	delete(key) {
		if (this.lib.hasOwnProperty(key))
			return delete this.lib[key];

		return false;
	}
}

class I18NManager extends Hookable {
	constructor(locale, settings) {
		super();
		this.locale = locale ? coerceIETF(locale) : new IETF("en");
		this.requestedLocale = this.locale;
		this.locales = [];
		this.settings = Object.assign({}, DEF_I18N_SETTINGS, settings);
		this.store = {};
		this.addedAssets = {};
		this.sitemap = null;
		this.stdLib = new STDLib(this.settings.stdLib || langStdLib);

		this.loader = new AssetLoader({
			fileName: (loader, fileName) => coerceToJSONFileName(fileName),
			fetchResponse: (loader, response, fileName) => {
				if (!response)
					console.error(`Failed to load locale data at ${fileName}`);

				return response;
			},
			xhrSettings: (loader, settings) => {
				return Object.assign({
					baseUrl: this.settings.baseUrl
				}, settings);
			},
			dependencies: (loader, dependent) => dependent.requires,
			assetNode: (loader, node, dependent, fileName) => {
				const name = stripJSONExtension(fileName),
					ex = /^(?:(.+?)\.)?(.+?)?$/.exec(name);
				
				if (ex) {
					node.name = ex[1] || "";
					node.locale = ex[2] || null;
				}
			}
		});

		if (this.settings.sitemapPath) {
			this.loader.prefetch(this.settings.sitemapPath, this.settings, {
				prefetchResponse: (loader, response, fileName) => {
					this.sitemap = response;
					if (!this.sitemap)
						return;

					for (const k in this.sitemap) {
						if (!this.sitemap.hasOwnProperty(k))
							continue;

						this.sitemap[k] = this.sitemap[k].map(s => new IETF(s));
					}
				}
			});
		}
	}

	interpolate(key, ...args) {
		let str = this.get(key);
		
		if (typeof str != "string")
			return str;

		for (let i = args.length - 1; i >= 0; i--)
			str = str.replace(new RegExp(`%${i - 1}(?![0-9])`, "g"), args[i]);
		
		return str;
	}

	get(accessor, ietf, copy) {
		const partition = this.getPartition(ietf),
			gotten = get(
				partition,
				accessor,
				NULL_GET
			);

		return copy ? clone(gotten) : gotten;
	}

	compose(format, vars, ietf, baseStore = {}) {
		ietf = coerceIETF(ietf);
		ietf = ietf.valid ? ietf : this.locale;
		vars = vars == null ?
			null :
			isObject(vars) ? vars : { x: vars };

		const path = splitPath(format),
			partition = this.getPartition(ietf);
		let formatTrace = null,
			outFormat = format;
		
		if (typeof format == "string") {
			formatTrace = resolveRefTrace(partition, path);
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
			store: Object.assign(baseStore, this.stdLib.lib, vars),
			manager: this,
			ietf
		});
	}

	dateCompose(format, vars, date, ietf) {
		if (typeof date == "string" || (typeof date == "number" && !isNaN(date)))
			date = new Date(date);
		if (!(date instanceof Date) || isNaN(date.valueOf()))
			date = new Date();

		return this.compose(format, vars, ietf, {
			date
		});
	}

	getPartition(ietf) {
		ietf = coerceIETF(ietf);
		ietf = ietf.valid ? ietf : this.locale;

		return this.store[ietf.value] || this.store[ietf.primary] || {};
	}

	setLocale(ietf, settings, lazy) {
		ietf = coerceIETF(ietf);

		this.requestedLocale = ietf;

		return new Promise(resolve => {
			this.loadLocale(ietf, settings, lazy)
				.then(partition => {
					const oldLocale = this.locale;

					if (partition)
						this.locale = ietf;
					
					this.dispatchLocaleLoad(ietf, oldLocale);
					resolve(!!partition, this.locale);
				});
		});
	}

	registerLocale(node, force = false) {
		force = typeof force == "boolean" ? force : false;

		const ietf = coerceIETF(node.locale),
			data = node.item,
			dependencies = node.dependencies,
			fileName = node.fileName;
		let newLocale = false;

		if (!isObj(data) || !ietf.valid)
			return console.warn(`Failed to register locale '${ietf.value}' because it's not an object or the IETF code is invalid`);
		if (this.addedAssets.hasOwnProperty(fileName) && !force)
			return console.warn(`Refused to add locale '${ietf.value}' because it's already defined. Use the force flag`);

		if (!this.store.hasOwnProperty(ietf.value)) {
			this.store[ietf.value] = initLocalePartition(data, dependencies, ietf.value);
			newLocale = true;
		}

		const now = performance.now();
		supplementPartitionData(this.store, data, ietf.value, !newLocale);
		console.log(performance.now() - now);

		setOwnership(this.store, ietf.value);
		shareOwnership(this.store);

		console.log("Registered", fileName);
		this.addedAssets[fileName] = data;
	}

	async loadLocale(fileName, settings = true, lazy = true) {
		fileName = coerceToJSONFileName(fileName);

		if (lazy && this.addedAssets.hasOwnProperty(fileName))
			return this.addedAssets[fileName];

		// This has to be tail recursive as dependents have
		// to be registered before their dependencies
		const applyLocales = dependent => {
			for (let i = 0, l = dependent.dependencies.length; i < l; i++)
				applyLocales(dependent.dependencies[i]);

			this.registerLocale(dependent, true);
		};

		const dependencyTree = await this.loader.fetchModule(fileName, settings, lazy);
		console.log(dependencyTree);
		
		if (dependencyTree) {
			applyLocales(dependencyTree);
			return dependencyTree.item;
		}

		return null;
	}

	loadFragment(fileName, settings = null, lazy = true) {
		fileName = coerceToJSONFileName(fileName);

		return new Promise(resolve => {
			const name = stripJSONExtension(fileName);

			if (name.indexOf(".") > -1)
				return resolve(null);

			let locale = this.requestedLocale;

			if (this.sitemap && this.sitemap.hasOwnProperty(name))
				locale = IETF.findOptimalLocale(this.requestedLocale, this.sitemap[name]);

			this.loadLocale(`${name}.${locale.value}`, settings, lazy)
				.then(d => {
					this.callHooks("fragmentloaded");
					this.callHooks(`fragmentloaded:${name}`);
					resolve(d);
				});
		});
	}

	dispatchLocaleLoad(locale, oldLocale) {
		this.callHooks("localeset");

		if (!locale.equals(oldLocale))
			this.callHooks("localechange");
	}
}

// Initializes a base locale partition (e.g. en, en_uk)
// and creates a reference table. The reference table contains
// locale data that describe which partition to seek supplementary data
// from if the partition doesn't have all it needs. This reference
// table is loaded sequentially, as to resemble a priority queue
// If a locale has dependencies from many different locales, the
// missing data resolver will go through the first requested through
// last requested locale. If the input data has a "default" field,
// that will be used as the primary source locale
function initLocalePartition(data, dependencies, locale) {
	const partition = {};
	setSymbol(partition, REF_TABLE_SYM, []);
	setSymbol(partition, LOCALE_SYM, locale);

	if (data.default)
		extendReferenceTable(partition, data.default);

	for (let i = 0, l = dependencies.length; i < l; i++)
		extendReferenceTable(partition, dependencies[i].locale);

	return partition;
}

function extendReferenceTable(partition, locale) {
	const ietf = coerceIETF(locale);

	if (!partition || !ietf.valid || partition[LOCALE_SYM] == locale)
		return false;

	const refTable = partition[REF_TABLE_SYM];
	if (refTable.indexOf(ietf.value) == -1) {
		refTable.push(ietf.value);
		return true;
	}

	return false;
}

function coerceToJSONFileName(fileName) {
	if (/\.json$/.test(fileName))
		return fileName;

	return `${fileName}.json`;
}

function stripJSONExtension(fileName) {
	return fileName.replace(/\.json$/, "");
}

function supplementPartitionData(store, inData, locale, onlyForNewFragments) {
	const targetPartition = store[locale],
		refTable = targetPartition[REF_TABLE_SYM];

	const supplement = (target, refs) => {
		for (let i = 0, l = refs.length; i < l; i++) {
			const ref = refs[i];

			for (const k in ref) {
				if (ref[k] == null || !ref.hasOwnProperty(k) || RESERVED_KEYS.hasOwnProperty(k))
					continue;

				if (target.hasOwnProperty(k) && target != null && typeof target[k] != "object")
					continue;

				if (typeof ref[k] != "object") {
					target[k] = ref[k];
					continue;
				}

				const newRefs = [];
				for (let j = 0, l2 = refs.length; j < l2; j++) {
					if (refs[j][k])
						newRefs.push(refs[j][k]);
				}

				if (target[k] && target[k][OWNER_SYM] != locale)
					target[k] = coerceToObj(null, ref[k]);
				else
					target[k] = coerceToObj(target[k], ref[k]);

				supplement(target[k], newRefs);
			}
		}
	};

	if (inData && onlyForNewFragments) {
		for (const k in inData) {
			if (!inData.hasOwnProperty(k) || RESERVED_KEYS.hasOwnProperty(k))
				continue;

			const refPartitions = inData[k] ? [inData[k]] : [];

			for (let i = 0, l = refTable.length; i < l; i++) {
				if (store[refTable[i]] && store[refTable[i]][k])
					refPartitions.push(store[refTable[i]][k]);
			}

			targetPartition[k] = coerceToObj(targetPartition[k], inData[k]);
			supplement(targetPartition[k], refPartitions);
		}
	} else {
		const refPartitions = inData ? [inData] : [];

		for (let i = 0, l = refTable.length; i < l; i++)
			refPartitions.push(store[refTable[i]]);

		supplement(targetPartition, refPartitions);
	}
}

function setOwnership(store, locale) {
	const set = target => {
		for (const k in target) {
			if (!target.hasOwnProperty(k) || !isObj(target[k]))
				continue;

			setSymbol(target[k], OWNER_SYM, locale);
			set(target[k]);
		}
	};

	set(store[locale]);
}

function shareOwnership(store) {
	for (const k in store) {
		if (!store.hasOwnProperty(k))
			continue;

		const partition = store[k],
			refTable = partition[REF_TABLE_SYM];

		for (let i = 0, l = refTable.length; i < l; i++) {
			const refPartition = store[refTable[i]];
			if (!refPartition)
				continue;

			for (const k2 in refPartition) {
				if (refPartition.hasOwnProperty(k2) && !partition.hasOwnProperty(k2))
					partition[k2] = refPartition[k2];
			}
		}
	}
}

const I18N = new I18NManager("en");

export default I18N;

export {
	I18NManager
};
