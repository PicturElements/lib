import {
	clone,
	hasOwn,
	inject,
	isObject
} from "@qtxr/utils";
import Storage from "./storage";
import * as suppliers from "./suppliers";

const dataMap = {
	data: "addData",
	provide: "addProvision",
	mixins: "addMixin",
	methods: "addMethod",
	computed: "addComputed",
	props: "addProp",
	components: "addComponent",
	watch: "addWatcher"
};

const DEFAULT_EXPORTERS = {
	data: {
		proxy: proxyInjectorExporter,
		export: injectorExporterRunner
	},
	provide: {
		proxy: proxyInjectorExporter,
		export: injectorExporterRunner
	},
	mixins: {
		export(args) {
			const mixins = [];

			const exp = mixin => {
				if (typeof mixin == "function")
					mixin = mixin(args);

				if (mixin instanceof ComponentWrapper)
					mixin = mixin.export();

				if (!isObject(mixin))
					throw new Error(`Cannot export mixin: mixin is not a vue component configuration object, component wrapper, or function that resolves to either`);
			
				mixins.push(mixin);
			};

			// Export named mixins
			const namedMixins = args.injectors[0];
			for (let i = 0, l = namedMixins.length; i < l; i++)
				exp(namedMixins[i].mixin);

			// Export anonymous mixins / mixin resolvers
			for (let i = 1, l = args.injectors.length; i < l; i++)
				exp(args.injectors[i]);

			return mixins;
		}
	}
};

class ComponentWrapperManager {
	constructor(config = {}) {
		this.suppliers = {};
		this.exporters = inject(config.exporters, DEFAULT_EXPORTERS);

		if (isObject(config.suppliers)) {
			for (const k in config.suppliers) {
				if (hasOwn(config.suppliers, k))
					this.supply(k, config.suppliers[k]);
			}
		}
	}

	wrap(component) {
		return new ComponentWrapper(component, this);
	}

	supply(name, supplier) {
		supplier = supplier || suppliers[name];
		if (!isObject(supplier))
			throw new Error(`Cannot supply '${name}': supplier is not an object`);
		if (!name || typeof name != "string")
			throw new Error(`Cannot supply: name (${name}) is not valid; name must be a truthy string`);
		if (this.suppliers.hasOwnProperty(name))
			throw new Error(`Cannot supply '${name}': this ComponentWrapperManager aready has a supplier with this name`);

		if (hasInit(supplier)) {
			const initializer = (...args) => {
				supplier = Object.assign({}, supplier);

				const initialized =  supplier.init(...args);

				if (typeof initialized == "function")
					supplier.use = initialized;
				else if (isObject(initialized))
					Object.assign(supplier, initialized);
				else
					throw new TypeError("Cannot initialize: initializer must resolve a use function or a config object");

				this.suppliers[name] = supplier;
				return this;
			};

			// Spoof supply and autoSupply functions to catch
			// unititated suppliers
			initializer.supply = initializer.autoSupply = _ => {
				throw new Error(`Uninitialized supplier found: '${name}'`);
			};

			return initializer;
		}
		
		this.suppliers[name] = supplier;
		return this;
	}

	autoSupply() {
		for (const k in suppliers) {
			if (hasOwn(suppliers, k) && !hasInit(suppliers[k]))
				this.supply(k);
		}

		return this;
	}
}

class ComponentWrapper {
	constructor(component, manager) {
		this.component = Object.assign(mkDefaultOptions(), component);
		this.used = {};
		this.suppliers = [];
		this.storage = new Storage();
		this.manager = manager || wc;

		// Exporter injectors. The first item in each partition is extendable by
		// calling the addition methods on the wrapper. Functional injectors can also
		// be added to these partitions, in which case they are added as injectors
		// to their respective partitions
		this.exporterInjectors = {
			mixins: [[]]
		};
		this.exporterInjectorKeys = ["data", "provide", "mixins"];

		// Move over data to injector so tracking of keys
		// can be done more cleanly
		for (let i = 0, l = this.exporterInjectorKeys.length; i < l; i++) {
			const key = this.exporterInjectorKeys[i];

			// Initialize injector partition
			this.exporterInjectors[key] = this.exporterInjectors[key] || [{}];
			this.add(key, this.component[key]);
			delete this.component[key];
		}
	}

	use(supplierName, ...args) {
		if (typeof supplierName != "string")
			throw new TypeError("Cannot use: supplier name must be a string");
		if (!this.manager.suppliers.hasOwnProperty(supplierName))
			throw new Error(`Cannot use: no known supplier with name '${supplierName}'`);

		let used = !!this.used[supplierName];
		const supplier = inject({
			name: supplierName
		}, this.manager.suppliers[supplierName]);

		const a = {
			used,
			wrapper: this,
			storage: this.storage.partition(supplierName)
		};

		if (supplier && (typeof supplier.isUsable != "function" || supplier.isUsable(a, ...args)))
			used = supplier.use(a, ...args) !== false;

		if (used && (!hasOwn(this.used, supplierName) || this.used[supplierName] !== true))
			this.suppliers.push(supplier);

		this.used[supplierName] = Boolean(this.used[supplierName] || used);
		return this;
	}

	getInjectorPartition(partititonName) {
		if (!this.exporterInjectors.hasOwnProperty(partititonName))
			throw new Error(`Cannot get injector partition at '${partititonName}': no partition found`);

		return this.exporterInjectors[partititonName][0];
	}

	// Generic function for adding data to components
	add(typeOrComponent, value) {
		if (isObject(typeOrComponent)) {
			let added = false;

			for (const k in typeOrComponent) {
				if (!typeOrComponent.hasOwnProperty(k))
					continue;

				added = this.add(k, typeOrComponent[k]) || added;
			}

			return added;
		}

		if (!value || typeof typeOrComponent != "string" || !dataMap.hasOwnProperty(typeOrComponent))
			return false;

		const addKey = dataMap[typeOrComponent];

		if (Array.isArray(value)) {
			for (let i = 0, l = value.length; i < l; i++)
				this[addKey](i, value[i]);
		} else if (isObject(value)) {
			for (const k in value) {
				if (value.hasOwnProperty(k))
					this[addKey](k, value[k]);
			}
		} else if (typeof value == "function") {
			if (!this.exporterInjectors.hasOwnProperty(typeOrComponent))
				throw new Error(`Cannot add injector at '${typeOrComponent}': no injector partition defined`);

			this.exporterInjectors[typeOrComponent].push(value);
		}

		return true;
	}

	addData(keyOrInjector, data) {
		if (typeof keyOrInjector == "function") {
			this.exporterInjectors.data.push(keyOrInjector);
			return;
		}

		if (typeof keyOrInjector != "string")
			return null;

		const injector = this.exporterInjectors.data[0];
		injector[keyOrInjector] = data;
		return data;
	}

	addProvision(keyOrInjector, provision) {
		if (typeof keyOrInjector == "function") {
			this.exporterInjectors.provide.push(keyOrInjector);
			return;
		}

		if (typeof keyOrInjector != "string")
			return null;
		
		const injector = this.exporterInjectors.provide[0];
		injector[keyOrInjector] = provision;
		return provision;
	}

	addMixin(keyOrInjector, mixin) {
		if (typeof keyOrInjector == "function") {
			this.exporterInjectors.mixin.push(keyOrInjector);
			return keyOrInjector;
		}

		if (typeof keyOrInjector != "string")
			return null;

		if (isObject(mixin))
			mixin = this.manager.wrap(mixin);

		if (!(mixin instanceof ComponentWrapper))
			throw new Error(`Cannot add mixin '${keyOrInjector}': supplied mixin is not an object or instance of ComponentWrapper`);

		const injector = this.exporterInjectors.mixins[0],
			wrappedMixin = {
				name: keyOrInjector,
				mixin
			};

		for (let i = 0, l = injector.length; i < l; i++) {
			if (injector[i].name == keyOrInjector) {
				injector[i] = wrappedMixin;
				return mixin;
			}
		}

		injector.push(wrappedMixin);
		return mixin;
	}

	addMethod(key, method) {
		const methods = this.component.methods;

		if (methods.hasOwnProperty(key))
			throw new Error(`Tried overriding method '${key}'`);
		if (typeof method != "function")
			throw new Error(`Cannot add method '${key}': supplied method is not a function`);

		methods[key] = method;
	}

	addComputed(key, comp) {
		const computed = this.component.computed;

		if (computed.hasOwnProperty(key))
			throw new Error(`Tried overriding computed property '${key}'`);
		if (typeof comp != "function")
			throw new Error(`Cannot add computed property '${key}': supplied value is not a function`);

		computed[key] = comp;
	}

	// Assumes props is already defined, through default options
	addProp(key, value) {
		const resolvedKey = resolvePropKey(key, value),
			resolvedValue = resolvePropValue(key, value),
			propsIsArray = Array.isArray(this.component.props);

		this.assert.hasUnusedProp(this.component.props, resolvedKey);

		if (propsIsArray)
			this.component.props.push(resolvedKey);
		else
			this.component.props[resolvedKey] = resolvedValue;

		return this.component.props;
	}

	addComponent(key, component) {
		const components = this.component.components;

		if (components.hasOwnProperty(key))
			throw new Error(`Tried overriding component '${key}'`);

		components[key] = component;
	}

	addHook(key, hook) {
		if (typeof hook != "function")
			throw new Error(`Cannot add hook '${key}': supplied hook is not a function`);

		nestHook(this.component, key, hook);
	}

	addWatcher(key, watcher) {
		if (typeof watcher != "function")
			throw new Error(`Cannot add watcher '${key}': supplied watcher is not a function`);

		nestHook(this.component.watch, key, watcher);
	}

	export() {
		const component = this.component,
			exporterInjectors = this.exporterInjectors;

		for (const k in exporterInjectors) {
			if (!exporterInjectors.hasOwnProperty(k))
				continue;

			const exporter = this.manager.exporters[k];

			const args = {
				exporter,
				name: k,
				wrapper: this,
				suppliers: this.suppliers,
				storage: this.storage,
				injectors: exporterInjectors[k]
			};

			if (typeof exporter.proxy == "function")
				component[k] = exporter.proxy(args);
			else
				component[k] = exporter.export(args);
		}
	
		return component;
	}

	// In most cases, it's preferable to use
	// the wc instance of ComponentWrapperManager,
	// and for legacy reasons these static methods
	// supply this single instance
	static supply(name, supplier) {
		return wc.supply(name, supplier);
	}

	static autoSupply() {
		return wc.autoSupply();
	}
}

ComponentWrapper.prototype.assert = {
	hasUnusedProp(props, key) {
		if (!props)
			throw new TypeError(`Cannot add property: property is not an object`);

		const err = _ => {
			throw new Error(`Cannot add property: found duplicate prop key '${key}'`);
		};
	
		if (Array.isArray(props) && props.indexOf(key) != -1)
			err();
		else if (isObject(props) && props.hasOwnProperty(key))
			err();
	}
};

function proxyInjectorExporter(args) {
	return function() {
		let out = {};

		for (let i = 0, l = args.injectors.length; i < l; i++) {
			const injector = args.injectors[i];
			let resolved;

			if (typeof injector == "function")
				resolved = injector.call(this);
			else
				resolved = clone(injector, "cloneSymbols|circular");

			inject(out, resolved, "injectSymbols|circular");
		}

		if (typeof args.exporter.export == "function") {
			out = args.exporter.export(inject({
				vm: this,
				out
			}, args, "shallow"));
		}

		return out;
	};
}

function injectorExporterRunner(args) {
	const suppliers = args.suppliers;

	for (let i = 0, l = suppliers.length; i < l; i++) {
		const supplier = suppliers[i];

		if (!supplier.export || typeof supplier.export[args.name] != "function")
			continue;

		const exporterArgs = inject({
			storage: args.storage.partition(supplier.name)
		}, args, "shallow");

		const exported = supplier.export[args.name](exporterArgs);

		if (isObject(exported))
			Object.assign(args.out, exported);
	}

	return args.out;
}

function mkDefaultOptions() {
	return {
		data: {},
		props: {},
		methods: {},
		computed: {},
		mixins: {},
		watch: {}
	};
}

function nestHook(target, key, hook) {
	if (typeof target[key] == "function") {
		const origHook = target[key];

		target[key] = function(...args) {
			origHook.apply(this, args);
			hook.apply(this, args);
		};
	} else 
		target[key] = hook;
}

function hasInit(supplier) {
	return supplier.hasOwnProperty("init") && typeof supplier.init == "function";
}

function resolvePropKey(key, value) {
	if (typeof key == "number")
		return value;

	return key;
}

function resolvePropValue(key, value) {
	if (typeof key == "number")
		return null;

	return value;
}

const wc = new ComponentWrapperManager();

export default wc;

export {
	ComponentWrapperManager,
	ComponentWrapper,
	proxyInjectorExporter,
	injectorExporterRunner
};
