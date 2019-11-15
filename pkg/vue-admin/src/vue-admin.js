import {
	get,
	hasOwn,
	isObject,
	resolveArgs
} from "@qtxr/utils";

import wc from "@qtxr/vue-wrap-component";
import { CustomJSON } from "@qtxr/uc";
import { Hookable } from "@qtxr/bc";

import { devWarn } from "./dev";
import AdminView from "./admin-view";

// Modules for various core tasks
import {
	parseRoutes,
	extractRoutes
} from "./modules/routing";

// Suppliers (used in .supply())
import * as suppliers from "./suppliers";

// Plugins used at runtime
import * as plugins from "./plugins";

const validViewIdRegex = /^[\w-]+$/;

const storeParams = [
	{ name: "path", type: "string", default: null },
	{ name: "state", type: Object, required: true }
];

const configKeys = {
	connect: true,
	connectAdmin: true
};

export default class VueAdmin extends Hookable {
	constructor(viewMap, config) {
		super();

		config = config || {};

		this.views = {};
		this.viewComponents = {};
		this.components = {};
		this.viewCount = 0;
		this.config = config;
		this.routes = [];
		this.routesMap = {};
		this.initialized = false;
		this.interfaces = {};
		this.methods = {};
		this.ui = {};
		this.mixins = {};
		this.plugins = Object.assign({}, plugins, config.plugins);
		this.pluginsMeta = {};

		// Utilities
		if (config.jsonManager instanceof CustomJSON)
			this.jsonManager = config.jsonManager;
		else if (isObject(config.jsonManager))
			this.jsonManager = new CustomJSON(config.jsonManager);
		else
			this.jsonManager = new CustomJSON();

		// Add views
		viewMap = viewMap || {};
		for (const k in viewMap) {
			if (!viewMap.hasOwnProperty(k))
				continue;

			this.view(
				k,
				viewMap[k].view,
				viewMap[k].model
			);
		}

		// Set up assertions
		this.assert = {
			hasInterface: interfaceName => {
				if (!this.interfaces.hasOwnProperty(interfaceName))
					throw new Error(`Assertion failed: no interface by name '${interfaceName}' exists`);
			},
			hasInterfaceMethod: (interfaceName, methodName) => {
				this.assert.hasInterface(interfaceName);

				const partition = this.interfaces[interfaceName];
				if (!partition.interface.hasOwnProperty(methodName) || typeof partition.interface[methodName] != "function")
					throw new Error(`Assertion failed: interface '${interfaceName}' doesn't have a method '${methodName}'`);
			}
		};
	}

	prepare(config) {
		if (config.components)
			this.components = config.components;
	}

	init() {
		if (this.initialized)
			return;

		this.initialized = true;
		this.callHooks("init");
	}

	view(id, component, viewConfig) {
		if (!id || typeof id != "string" || !validViewIdRegex.test(id))
			throw new Error(`Cannot create view: invalid ID`);
		if (this.views.hasOwnProperty(id))
			throw new Error(`Cannot create view: a view with ID '${id}' already exists`);
		if (!component)
			throw new Error(`Cannot create view: invalid component`);

		const view = new AdminView(this, viewConfig);

		this.viewComponents[id] = component;
		this.views[id] = view;
		this.viewCount++;
		return this;
	}
	
	route(routeTree) {
		this.routes = parseRoutes(this, routeTree);
		this.usePlugin("routing", this.routes);
	}

	getRoutes() {
		return extractRoutes(this.routes, null, "");
	}

	store(...args) {
		const {
			path,
			state
		} = resolveArgs(args, storeParams);

		this.callInterfaceMethod("store", "setupStore")(path, state);
	}

	sessionStore(...args) {
		const {
			path,
			state
		} = resolveArgs(args, storeParams);

		this.callInterfaceMethod("store", "setupSessionStore")(path, state);
	}

	localStore(...args) {
		const {
			path,
			state
		} = resolveArgs(args, storeParams);

		this.callInterfaceMethod("store", "setupLocalStore")(path, state);
	}

	mixin(nameOrMixin, mixin) {

	}

	// Signatures:
	// component - single component with no direct view/model
	// id, view  - named view with accompanying model
	wrap(idOrComponent, view) {
		// Component
		if (isObject(idOrComponent) && !view)
			this.wrapC(idOrComponent);

		// View
		if (typeof idOrComponent != "string")
			throw new Error("Cannot wrap view component: ID is not a string");
		if (!this.views.hasOwnProperty(idOrComponent))
			throw new Error(`Cannot wrap view component: '${idOrComponent}' is not a known view`);
		if (!isObject(view))
			throw new Error(`Cannot wrap view component: supplied view '${idOrComponent}' is not a view object`);

		injectComponents(this, view);

		const wrapper = wc.wrap(view);
		this.views[idOrComponent].connect(wrapper);
		connect(this, wrapper);
		return wrapper;
	}

	wrapC(component) {
		if (!isObject(component))
			throw new Error(`Cannot wrap component: supplied component is not a component object`);

		const wrapper = wc.wrap(component);
		connect(this, wrapper);
		return wrapper;
	}

	supply(interfaceName, supplier) {
		supplier = supplier || suppliers[interfaceName];
		if (!isObject(supplier))
			throw new Error(`Cannot supply '${interfaceName}': supplier is not an object`);

		if (supplier.hasOwnProperty("interfaceName") && typeof supplier.interfaceName == "string")
			interfaceName = supplier.interfaceName;

		if (!interfaceName || typeof interfaceName != "string")
			throw new Error(`Cannot supply: interface (${interfaceName}) is not valid`);
		if (this.interfaces.hasOwnProperty(interfaceName))
			throw new Error(`Cannot supply '${interfaceName}': VueAdmin instance aready has an interface with this name`);

		if (hasInit(supplier)) {
			const initializer = (...args) => {
				this.interfaces[interfaceName] = {
					interface: stripConfigProps(supplier.init(this, ...args)),
					config: supplier
				};

				if (supplier.hasOwnProperty("connectAdmin") && typeof supplier.connectAdmin == "function")
					supplier.connectAdmin(this);

				return this;
			};

			initializer.supply = _ => {
				throw new Error(`Uninitialized interface found: '${interfaceName}'`);
			};

			initializer.autoSupply = initializer.supply;

			return initializer;
		}
		
		this.interfaces[interfaceName] = {
			interface: stripConfigProps(supplier),
			config: supplier
		};

		if (supplier.hasOwnProperty("connectAdmin") && typeof supplier.connectAdmin == "function")
			supplier.connectAdmin(this);

		return this;
	}

	autoSupply() {
		for (const k in suppliers) {
			if (hasOwn(suppliers, k) && !hasInit(suppliers[k]))
				this.supply(k);
		}

		return this;
	}

	usePlugin(pluginName, ...args) {
		if (!this.plugins.hasOwnProperty(pluginName))
			throw new Error(`Cannot use plugin: '${pluginName}' is not a known plugin`);
		
		const plugin = this.plugins[pluginName],
			meta = this.pluginsMeta[pluginName] || {
				uses: 0,
				plugin
			};

		const pluginValidation = validatePlugin(plugin);

		if (pluginValidation)
			throw new Error(`Cannot use plugin: ${pluginValidation} (at plugin '${pluginName}')`);

		this.pluginsMeta[pluginName] = meta;
		if (plugin.useOnce && meta.uses > 0)
			return this;

		plugin.use(this, meta, ...args);

		meta.uses++;
		return this;
	}

	callInterfaceMethod(interfaceName, methodName, withContext = false) {
		this.assert.hasInterfaceMethod(interfaceName, methodName);

		return (...args) => {
			const inter = this.interfaces[interfaceName].interface;

			if (withContext) {
				return inter[methodName]({
					admin: this
				}, ...args);
			}

			return inter[methodName](...args);
		};
	}

	addMethod(methodName, method) {
		if (typeof method != "function") {
			devWarn();
			return this;
		}

		this.methods[methodName] = method;
		return this;
	}

	callMethod(methodName, withContext = false, strict = false) {
		if (!this.methods.hasOwnProperty(methodName)) {
			if (strict)
				throw new Error(`Cannot call method: no known method by name '${methodName}'`);

			return noop;
		}

		if (typeof this.methods[methodName] != "function") {
			if (strict)
				throw new Error(`Cannot call method: method '${methodName}' is not a function`);

			return noop;
		}

		const method = this.methods[methodName];

		return (...args) => {
			if (withContext) {
				return method({
					admin: this
				}, ...args);
			}
			
			return method(...args);
		};
	}
}

function injectComponents(admin, view) {
	const components = Object.assign({}, admin.components),
		viewComponents = view.components;

	for (const k in viewComponents) {
		if (!viewComponents.hasOwnProperty(k) || typeof viewComponents[k] != "string")
			continue;

		const component = get(components, viewComponents[k]);

		if (!isComponent(component))
			throw new Error(`Failed to resolve component '${k}' at '${viewComponents[k]}' in ${view.name || "unknown view"}`);

		viewComponents[k] = component;
	}

	for (const k in components) {
		if (!components.hasOwnProperty(k) || !isComponent(components[k]) || viewComponents.hasOwnProperty(k))
			continue;

		viewComponents[k] = components[k];
	}
}

function isComponent(candidate) {
	return Boolean(candidate) && typeof candidate == "object" && candidate.hasOwnProperty("_compiled");
}

function connect(admin, wrapper) {
	wrapper.addData("admin", admin);

	const interfaces = admin.interfaces;
	for (const k in interfaces) {
		if (!interfaces.hasOwnProperty(k))
			continue;

		const { config } = interfaces[k];

		if (!config.hasOwnProperty("connect") || typeof config.connect != "function")
			continue;

		config.connect(admin, wrapper);
	}
}

function hasInit(supplier) {
	return supplier.hasOwnProperty("init") && typeof supplier.init == "function";
}

function stripConfigProps(inter) {
	const stripped = {};

	for (const k in inter) {
		if (inter.hasOwnProperty(k) && !configKeys.hasOwnProperty(k))
			stripped[k] = inter[k];
	}

	return stripped;
}

function validatePlugin(plugin) {
	if (!isObject(plugin))
		return "Plugins must be objects";

	if (typeof plugin.use != "function")
		return "Plugins must define a use method";

	return null;
}

function noop() {}
