import {
	clone, 
	get,
	inject,
	sym,
	isObject,
	resolveArgs
} from "@qtxr/utils";
import { Hookable } from "@qtxr/bc";
import {
	XHRManager,
	XHRState,
	decodeData
} from "@qtxr/request";
import ScrollStops from "@qtxr/scroll-stops";

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
			throw new Error("'use' endpoint must be a string");

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

	static setAsset(name, asset) {
		ComponentWrapper.assets[name] = asset;
	}
}

ComponentWrapper.assets = {
	i18nManager: null
};

ComponentWrapper.endpoints = {
	xhr: {
		use: useXhr,
	},
	live: {
		use: useLive
	},
	events: {
		use: useEvents,
		isUsable(wrapper, used) {
			if (!used)
				return true;

			console.warn("Events cannot be used more than once because only one event partition and a singular method are allowed to be initiated");
			return false;
		}
	},
	scrollStops: {
		use: useScrollStops
	},
	i18n: {
		use: useI18N
	},
	debounce: {
		use: useDebounce
	},
	hooks: {
		use: useHooks
	},
	tasks: {
		use: useTasks
	}
};

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

function useXhr(wrapper, used, path) {
	const component = wrapper.component,
		xhrPartitions = wrapper.internal.xhrPartitions || {},
		data = wrapper.getInjectorPartition("data");

	const gotten = get(data, path, null, {
			autoBuild: true,
			context: true
		}),
		state = {
			loaded: false,
			loading: false,
			error: false,
			msg: ""
		};

	for (const k in state) {
		if (state.hasOwnProperty(k) && !gotten.data.hasOwnProperty(k))
			gotten.data[k] = state[k];
	}

	const xhrState = new XHRState()
		.hook("static:init", runtime => {
			setLoadingState(runtime.loadingState, "loading");
		})
		.hook("static:success", runtime => {
			setLoadingState(runtime.loadingState, "success");
		})
		.hook("static:fail", runtime => {
			setLoadingState(runtime.loadingState, "error");
		});

	const manager = new XHRManager({
		flush: ["once"],
		withRuntime: true,
		state: xhrState
	});

	xhrPartitions[path] = {
		manager,
		xhrState
	};
	wrapper.internal.xhrPartitions = xhrPartitions;

	if (used)
		return;

	component.methods.xhr = function(path) {
		const vm = this,
			partition = xhrPartitions[path];

		if (!partition)
			throw new Error(`Cannot access XHR partition at '${path}' because it's not registered`);

		const loadingState = get(vm.$data, path);

		partition.manager.attachRuntime({
			vm,
			loadingState,
			setMsg(msg) {
				loadingState.msg = msg;
			},
			resolveErrorMsg() {
				const xhr = partition.manager.settings.state.xhr;

				if (xhr.responseText)
					this.setMsg(decodeData(xhr).message);
				else
					this.setMsg(`Network error (${xhr.status})`);
			}
		});

		return partition.manager;
	};

	component.methods.setLoadingState = function(partition, state) {
		const dp = this.$data && this.$data[partition];

		if (!this.$data.hasOwnProperty(partition) || !dp || dp.constructor != Object)
			return;

		setLoadingState(dp, state);
	};
}

function setLoadingState(partition, data) {
	if (!partition)
		return;

	let state = {
		loaded: false,
		loading: false,
		error: false
	};

	if (data && data.constructor == Object)
		state = data;
	else switch (data) {
		case "loading":
			state.loading = true;
			break;
		case "success":
			state.loaded = true;
			break;
		case "error":
			state.error = true;
			break;
	}

	for (const k in partition) {
		if (partition.hasOwnProperty(k))
			partition[k] = state[k];
	}
}

function useLive(wrapper, used, data) {
	if (!used)
		wrapper.internal.live = {};

	inject(wrapper.internal.live, data, {
		override: true,
		injectSymbols: true,
		shallow: true
	});
}

function useEvents(wrapper, used, partitionName = "events") {
	const component = wrapper.component,
		data = wrapper.getInjectorPartition("data");
	
	if (!data.hasOwnProperty(partitionName))
		data[partitionName] = [];
	else if (!Array.isArray(data[partitionName].constructor)) {
		console.warn(`Will refuse to use events because component data already has a non-array property with key '${partitionName}'`);
		return false;
	}

	component.methods.addEventListener = function(target, type, callback, options) {
		if (typeof callback != "function")
			return console.warn("Cannot add event listener: callback is not a function");

		const partition = this.$data[partitionName],
			vm = this,
			// Assumes that no event handler is called with more than the event as its args
			interceptingCallback = function(evt) {
				callback.call(this, evt, vm);
			};

		partition.push({
			target,
			type,
			callback: interceptingCallback,
			options
		});

		target.addEventListener(type, interceptingCallback, options);
	};

	nestHook(component, "beforeDestroy", function() {
		const partition = this.$data[partitionName];
		partition.forEach(p => p.target.removeEventListener(p.type, p.callback, p.options));
	});
}

const scrollStopsParams = [
	{ name: "name", type: "string", default: "scrollStops" },
	{ name: "options", type: "object", default: {} }
];

function useScrollStops(wrapper, used, ...args) {
	const component = wrapper.component;

	const {
		name,
		options
	} = resolveArgs(args, scrollStopsParams);

	// Prep data object for reactivity
	wrapper.addData(name, null);

	nestHook(component, (options.on || "beforeMount"), function() {
		const elem = options.element;
		options.elem = typeof elem == "function" ? elem.call(this, elem) : elem;
		this.$data[name] = new ScrollStops(options);
		this.$data[name].thisVal = this;
	});

	nestHook(component, (options.off || "beforeDestroy"), function() {
		this.$data[name].destroy();
	});
}

function useI18N(wrapper, used) {
	if (used)
		return;

	assertHasAsset("i18nManager", "i18n");
	
	const manager = ComponentWrapper.assets.i18nManager,
		methods = wrapper.component.methods,
		ns = sym("wc-i18n-ns");
	
	methods.loadLocaleFragment = manager.loadFragment.bind(manager);
	methods.hookLocale = (...args) => manager.hookNS(ns, ...args);

	nestHook(wrapper.component, "beforeDestroy", _ => manager.clearHooksNS(ns));
}

function useDebounce(wrapper, used, name, timeout = 50) {
	const component = wrapper.component,
		int = wrapper.internal;

	int.debounce = int.debounce || {};
	int.debounce[name] = new Debouncer(timeout);

	wrapper.addData(name, int.debounce[name]);

	if (used)
		return;
	
	nestHook(component, "beforeDestroy", _ => {
		for (const k in int.debounce) {
			if (int.debounce.hasOwnProperty(k))
				int.debounce[k].clear();
		}
	});
}

class Debouncer extends Hookable {
	constructor(timeout) {
		super();
		this.timeout = timeout;
		this.timer = null;
		this.callback = null;
	}

	debounce(callback, timeout) {
		this.callback = callback;
		this.clear();
		const to = typeof timeout == "number" ? timeout : this.timeout;
		this.timer = setTimeout(callback, to);
	}

	clear() {
		clearTimeout(this.timer);
	}
}

function useHooks(wrapper, used, name = "hooks") {
	const component = wrapper.component,
		int = wrapper.internal;

	int.hooks = int.hooks || [];
	const hooks = wrapper.addData(name, new Hookable());
	int.hooks.push(hooks);

	if (used)
		return;

	nestHook(component, "mounted", _ => {
		int.hooks.forEach(h => h.clearHooks());
	});
}

const taskHooks = ["beforeMount", "mounted", "beforeUpdate", "updated"];

function useTasks(wrapper, used) {
	const component = wrapper.component;

	if (used)
		return;

	taskHooks.forEach(hookName => {
		nestHook(component, hookName, function() {
			const tasks = this.$props.tasks;
			runTasks(this, tasks, hookName);
		});
	});

	addProp(component.props, "tasks", null, "tasks");
}

function runTasks(vm, tasks, hookName) {
	if (!tasks)
		return;
	
	if (typeof tasks == "function")
		tasks(vm, hookName);
	else if (Array.isArray(tasks)) {
		for (let i = 0, l = tasks.length; i < l; i++) {
			if (typeof tasks[i] == "function")
				tasks[i](vm, hookName);
		}
	} else if (isObject(tasks)) {
		for (const k in tasks) {
			if (!tasks.hasOwnProperty(k) || k != hookName)
				continue;

			const task = tasks[k];

			if (typeof task == "function")
				tasks[k](vm, hookName);
			else
				runTasks(vm, task);
		}
	}
}

// Assertions
function assertUnusedProp(props, name, useName) {
	if (!props)
		throw new TypeError(`Cannot use ${useName}: property is not an object`);

	if (Array.isArray(props) && props.indexOf(name) != -1)
		err();
	else if (isObject(props) && props.hasOwnProperty(name))
		err();

	function err() {
		throw new Error(`Cannot use ${useName}: found duplicate prop key '${name}'`);
	}
}

function assertHasAsset(assetName, useName) {
	if (!ComponentWrapper.assets.hasOwnProperty(assetName) || !ComponentWrapper.assets[assetName])
		throw new Error(`Cannot use ${useName}: no asset by name '${assetName}' is available`);
}

// Utils
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

// Assumes props is already defined, through default options
function addProp(props, name, descriptor, useName) {
	assertUnusedProp(props, name, useName);

	if (Array.isArray(props))
		props.push(name);
	else if (isObject(props))
		props[name] = descriptor;

	return props;
}

export default wc;

export {
	ComponentWrapper
};
