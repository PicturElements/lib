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
	methods: "addMethod",
	computed: "addComputed",
	props: "addProp",
	components: "addComponent"
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

		const injectors = {
			data: null,
			provide: null
		};

		// Move over data to injector so tracking of keys
		// can be done more cleanly
		for (const k in injectors) {
			if (!injectors.hasOwnProperty(k))
				continue;

			if (isObject(this.component[k])) {
				injectors[k] = this.component[k];
				this.component[k] = {};
			}
		}

		this.exporterInjectors = injectors;
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

	// Generic function for adding data to components
	add(type, value) {
		if (!value || !dataMap.hasOwnProperty(type))
			return false;

		const addKey = dataMap[type];

		if (Array.isArray(value)) {
			for (let i = 0, l = value.length; i < l; i++)
				this[addKey](i, value[i]);
		} else {
			for (const k in value) {
				if (value.hasOwnProperty(k))
					this[addKey](k, value[k]);
			}
		}

		return true;
	}

	addData(key, value) {
		return this._addToInjector("data", key, value);
	}

	addProvision(key, value) {
		return this._addToInjector("provide", key, value);
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

	// Returns an exesting partition or creates a new one
	// on the instance's injector object
	getInjectorPartition(partitionName) {
		const partition = this.exporterInjectors[partitionName] || {};
		this.exporterInjectors[partitionName] = partition;
		return partition;
	}

	_addToInjector(partitionName, key, value) {
		const partition = this.getInjectorPartition(partitionName);

		if (partition.hasOwnProperty(key))
			throw new Error(`Tried overriding property '${key}' (in ${partitionName})`);

		partition[key] = value;
		return value;
	}

	export() {
		const component = this.component,
			injectors = this.exporterInjectors;

		for (const k in injectors) {
			if (!injectors.hasOwnProperty(k))
				continue;

			component[k] = mkInjectorExporter(k, component[k], this);
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
	data(obj, wrapper, vm) {
		const {
			live,
			computedData
		} = wrapper.internal;

		if (live) {
			inject(obj, live, {
				override: true,
				injectSymbols: true,
				shallow: true
			});
		}

		if (computedData) {
			for (const k in computedData) {
				if (computedData.hasOwnProperty(k) && typeof computedData[k] == "function")
					obj[k] = computedData[k](wrapper, vm);
			}
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

// By default, data already specified in fields cannot
// be overwritten but are free to be extended
function mkInjectorExporter(name, data, wrapper) {
	return function() {
		let outObj = {};
			
		if (typeof data == "function")
			outObj = data.call(this);
		else if (isObject(data))
			outObj = clone(data, "cloneSymbols");

		const injectors = wrapper.exporterInjectors,
			injectorData = injectors[name];

		if (injectors.hasOwnProperty(name) && injectorData)
			inject(outObj, injectorData);

		if (ComponentWrapper.exporters.hasOwnProperty(name))
			ComponentWrapper.exporters[name](outObj, wrapper, this);

		return outObj;
	};
}

function mkDefaultOptions() {
	return {
		data: {},
		props: {},
		methods: {},
		computed: {}
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
