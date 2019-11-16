import {
	clone,
	hasOwn,
	inject,
	isObject
} from "@qtxr/utils";
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

const wc = {
	wrap(component) {
		return new ComponentWrapper(component);
	}
};

class ComponentWrapper {
	constructor(component) {
		this.component = Object.assign(mkDefaultOptions(), component);
		this.used = {};
		this.internal = {};

		// Initialize injectors with data. The first partition will be extendable by
		// calling the addition methods on the wrapper. Functional injectors can also
		// be added to these partitions, whereupon these are added as sub-injectors on
		// in their respective partitions
		this.exporterInjectors = {
			data: [{}],
			provide: [{}],
			mixins: [[]]
		};

		// Move over data to injector so tracking of keys
		// can be done more cleanly
		for (const k in this.exporterInjectors) {
			if (!this.exporterInjectors.hasOwnProperty(k))
				continue;

			this.add(k, this.component[k]);
			delete this.component[k];
		}
	}

	use(endpoint, ...args) {
		if (typeof endpoint != "string")
			throw new Error("'use' endpoint key must be a string");

		let used = !!this.used[endpoint];
		const ep = ComponentWrapper.endpoints[endpoint];

		if (ep && (typeof ep.isUsable != "function" || ep.isUsable(this, used, ...args)))
			used = ep.use(this, used, ...args) !== false;

		this.used[endpoint] = used;
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
			mixin = wc.wrap(mixin);

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

			const exporter = ComponentWrapper.exporters[k];

			const args = {
				wrapper: this,
				injectors: exporterInjectors[k],
				exporter,
				name: k
			};

			if (typeof exporter.wrap == "function")
				component[k] = exporter.wrap(args);
			else
				component[k] = exporter.export(args);
		}
	
		return component;
	}

	static supply(name, supplier) {
		supplier = supplier || suppliers[name];
		if (!isObject(supplier))
			throw new Error(`Cannot supply '${name}': supplier is not an object`);
		if (!name || typeof name != "string")
			throw new Error(`Cannot supply: name (${name}) is not valid`);
		if (this.endpoints.hasOwnProperty(name))
			throw new Error(`Cannot supply '${name}': ComponentWrapper aready has an endpoint with this name`);

		if (hasInit(supplier)) {
			const initializer = (...args) => {
				supplier = Object.assign({}, supplier);
				supplier.use = supplier.init(...args);
				this.endpoints[name] = supplier;
				return this;
			};

			initializer.supply = _ => {
				throw new Error(`Uninitialized endpoint found: '${name}'`);
			};

			initializer.autoSupply = initializer.supply;

			return initializer;
		}
		
		this.endpoints[name] = supplier;
		return this;
	}

	static autoSupply() {
		for (const k in suppliers) {
			if (hasOwn(suppliers, k) && !hasInit(suppliers[k]))
				this.supply(k);
		}

		return this;
	}
}

ComponentWrapper.endpoints = {};

ComponentWrapper.exporters = {
	data: {
		wrap: wrapInjectorExporter,
		export({ out, wrapper, vm }) {
			const {
				live,
				computedData
			} = wrapper.internal;

			if (live) {
				inject(out, live, {
					override: true,
					injectSymbols: true,
					shallow: true,
					circular: true
				});
			}

			if (computedData) {
				for (const k in computedData) {
					if (computedData.hasOwnProperty(k) && typeof computedData[k] == "function")
						out[k] = computedData[k](wrapper, vm);
				}
			}
		}
	},
	provide: {
		wrap: wrapInjectorExporter
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

ComponentWrapper.prototype.assert = {
	hasUnusedProp(props, key) {
		if (!props)
			throw new TypeError(`Cannot add property: property is not an object`);
	
		if (Array.isArray(props) && props.indexOf(key) != -1)
			err();
		else if (isObject(props) && props.hasOwnProperty(key))
			err();
	
		function err() {
			throw new Error(`Cannot add property: found duplicate prop key '${key}'`);
		}
	}
};

function wrapInjectorExporter(args) {
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
			args.exporter.export(Object.assign({
				out,
				vm: this
			}, args));
		}

		return out;
	};
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
			origHook.call(this, args);
			hook.call(this, args);
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

export default wc;

export {
	ComponentWrapper
};
