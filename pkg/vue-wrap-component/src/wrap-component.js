import {
	clone,
	inject,
	isObject
} from "@qtxr/utils";
import * as suppliers from "./suppliers";

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

	addData(key, value) {
		return this._addToInjector("data", key, value);
	}

	addProvision(key, value) {
		return this._addToInjector("provide", key, value);
	}

	// Assumes props is already defined, through default options
	addProp(key, value, useName) {
		this.assert.hasUnusedProp(this.component.props, key, useName);
		this.component.props[key] = value;
		return this.component.props;
	}

	addMethod(key, method) {
		const methods = this.component.methods;

		if (methods.hasOwnProperty(key))
			throw new Error(`Tried overriding method '${key}'`);
		if (typeof method != "function")
			throw new Error(`Cannot add method '${key}': supplied method is not a function`);

		methods[key] = method;
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

		if (supplier.hasOwnProperty("init") && typeof supplier.init == "function") {
			return (...args) => {
				supplier = Object.assign(supplier);
				supplier.use = supplier.init(...args);
				this.endpoints[name] = supplier;
				return this;
			};
		}
		
		this.endpoints[name] = supplier;
		return this;
	}
}

ComponentWrapper.endpoints = {};

ComponentWrapper.exporters = {
	data(obj, wrapper, vm) {
		if (wrapper.internal.live) {
			inject(obj, wrapper.internal.live, {
				override: true,
				injectSymbols: true,
				shallow: true
			});
		}
	}
};

ComponentWrapper.prototype.assert = {
	hasUnusedProp(props, key, useName) {
		if (!props)
			throw new TypeError(`Cannot use ${useName}: property is not an object`);
	
		if (Array.isArray(props) && props.indexOf(key) != -1)
			err();
		else if (isObject(props) && props.hasOwnProperty(key))
			err();
	
		function err() {
			throw new Error(`Cannot use ${useName}: found duplicate prop key '${key}'`);
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

export default wc;

export {
	ComponentWrapper
};
