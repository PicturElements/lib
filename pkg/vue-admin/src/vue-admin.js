import {
	get,
	hasOwn,
	isObject,
	resolveArgs,
	compileTaggedTemplate
} from "@qtxr/utils";

import { ComponentWrapperManager } from "@qtxr/vue-wrap-component";
import { CustomJSON } from "@qtxr/uc";
import { Hookable } from "@qtxr/bc";

import { devWarn } from "./dev";
import AdminView from "./admin-view";

// Modules for various core tasks
import {
	parseRoutes,
	extractRoutes
} from "./modules/routing";

// Interfaces (used in .supply() and .autoSupply())
import * as interfaces from "./interfaces";

// Plugins used at runtime
import * as plugins from "./plugins";

const validViewIdRegex = /^[\w-]+$/;

const storeParams = [
	{ name: "path", type: "string", default: null },
	{ name: "state", type: Object, required: true }
];

const interfaceConfigKeys = {
	connect: true,
	connectAdmin: true
};

const pluginConfigKeys = {
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
		this.registeredPlugins = Object.assign(
			{},
			plugins,
			config.plugins
		);

		this.ui = {};

		this.interfaces = {};
		this.methods = {};
		this.mixins = {};
		this.plugins = {};

		// Utilities
		if (config.jsonManager instanceof CustomJSON)
			this.jsonManager = config.jsonManager;
		else if (isObject(config.jsonManager))
			this.jsonManager = new CustomJSON(config.jsonManager);
		else
			this.jsonManager = new CustomJSON();

		if (config.wrapperManager instanceof ComponentWrapperManager)
			this.wrapperManager = config.wrapperManager;
		else if (isObject(config.wrapperManager))
			this.wrapperManager = new ComponentWrapperManager(config.wrapperManager);
		else
			this.wrapperManager = new ComponentWrapperManager();

		// Add views
		viewMap = viewMap || {};
		for (const k in viewMap) {
			if (!hasOwn(viewMap, k, false))
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
				if (!hasOwn(this.interfaces, interfaceName))
					throw new Error(`Assertion failed: no interface by name '${interfaceName}' exists`);
			},
			hasInterfaceMethod: (interfaceName, methodName) => {
				this.assert.hasInterface(interfaceName);

				const partition = this.interfaces[interfaceName];
				if (!hasOwn(partition.interface, methodName) || typeof partition.interface[methodName] != "function")
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
		if (hasOwn(this.views, id))
			throw new Error(`Cannot create view: a view with ID '${id}' already exists`);
		if (!component)
			throw new Error(`Cannot create view: invalid component`);

		const view = new AdminView(this, viewConfig);

		this.viewComponents[id] = component;
		this.views[id] = view;
		this.viewCount++;
		return this;
	}

	route(...routeData) {
		const routeTree = compileTaggedTemplate(...routeData);
		this.routes = parseRoutes(this, routeTree);
		this.usePlugin("routing");
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
		let name = nameOrMixin;

		if (typeof nameOrMixin != "string") {
			mixin = nameOrMixin;
			name = "default";
		}

		if (!name || typeof name != "string")
			throw new Error(`Cannot define mixin: invalid mixin name (${name})`);

		this.mixins[name] = mixin;
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
		if (!hasOwn(this.views, idOrComponent))
			throw new Error(`Cannot wrap view component: '${idOrComponent}' is not a known view`);
		if (!isObject(view))
			throw new Error(`Cannot wrap view component: supplied view '${idOrComponent}' is not a view object`);

		injectComponents(this, view);

		const wrapper = wrapComponent(this, view),
			meta = {
				type: "view",
				source: view,
				id: idOrComponent
			};

		this.views[idOrComponent].connect(wrapper, meta);
		connect(this, wrapper, meta);
		return wrapper;
	}

	wrapC(component) {
		if (!isObject(component))
			throw new Error(`Cannot wrap component: supplied component is not a component object`);

		const wrapper = wrapComponent(this, component),
			meta = {
				type: "component",
				source: component
			};

		connect(this, wrapper, meta);
		return wrapper;
	}

	supply(interfaceName, inter) {
		inter = inter || interfaces[interfaceName];
		if (!isObject(inter))
			throw new Error(`Cannot supply '${interfaceName}': interface is not an object`);

		if (hasOwn(inter, "interfaceName") && typeof inter.interfaceName == "string")
			interfaceName = inter.interfaceName;

		if (!interfaceName || typeof interfaceName != "string")
			throw new Error(`Cannot supply: interface (${interfaceName}) is not valid`);
		if (hasOwn(this.interfaces, interfaceName))
			throw new Error(`Cannot supply '${interfaceName}': VueAdmin instance aready has an interface with this name`);

		if (hasInit(inter)) {
			const initializer = (...args) => {
				this.interfaces[interfaceName] = {
					interface: stripConfigProps(inter.init(this, ...args), interfaceConfigKeys),
					config: inter
				};

				if (hasOwn(inter, "connectAdmin") && typeof inter.connectAdmin == "function")
					inter.connectAdmin(this);

				return this;
			};

			initializer.supply = _ => {
				throw new Error(`Uninitialized interface found: '${interfaceName}'`);
			};

			initializer.autoSupply = initializer.supply;

			return initializer;
		}

		this.interfaces[interfaceName] = {
			interface: stripConfigProps(inter),
			config: inter
		};

		if (hasOwn(inter, "connectAdmin") && typeof inter.connectAdmin == "function")
			inter.connectAdmin(this);

		return this;
	}

	autoSupply() {
		for (const k in interfaces) {
			if (hasOwn(interfaces, k) && !hasInit(interfaces[k]))
				this.supply(k);
		}

		return this;
	}

	registerPlugin(pluginName, pluginConfig) {
		if (!pluginName || typeof pluginName != "string")
			throw new Error(`Cannot register plugin: invalid plugin name (${pluginName})`);

		const pluginValidation = validatePlugin(pluginConfig);

		if (pluginValidation)
			throw new Error(`Cannot register plugin: ${pluginValidation} (as '${pluginName}')`);

		this.registeredPlugins[pluginName] = pluginConfig;
		return this;
	}

	usePlugin(pluginName, ...args) {
		if (typeof pluginName != "string" || !hasOwn(this.registeredPlugins, pluginName))
			return this;

		const plugin = this.plugins[pluginName] || {
			plugin: stripConfigProps(this.registeredPlugins[pluginName], pluginConfigKeys),
			config: this.registeredPlugins[pluginName],
			meta: {
				uses: 0,
				plugin: this.registeredPlugins[pluginName]
			}
		};

		const pluginValidation = validatePlugin(plugin.config);

		if (pluginValidation)
			throw new Error(`Cannot use plugin: ${pluginValidation} (at plugin '${pluginName}')`);

		if (plugin.config.useOnce && plugin.meta.uses > 0)
			return this;

		plugin.config.use(this, plugin.meta, ...args);

		if (hasOwn(plugin.config, "connectAdmin") && typeof plugin.config.connectAdmin == "function")
			plugin.config.connectAdmin(this);

		plugin.meta.uses++;
		this.plugins[pluginName] = plugin;
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
			devWarn(this, "Cannot add method: supplied value is not a function");
			return this;
		}

		this.methods[methodName] = method;
		return this;
	}

	callMethod(methodName, withContext = false, strict = false) {
		if (!hasOwn(this.methods, methodName)) {
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
		if (!hasOwn(viewComponents, k) || typeof viewComponents[k] != "string")
			continue;

		const component = get(components, viewComponents[k]);

		if (!isComponent(component))
			throw new Error(`Failed to resolve component '${k}' at '${viewComponents[k]}' in ${view.name || "unknown view"}`);

		viewComponents[k] = component;
	}

	for (const k in components) {
		if (!hasOwn(components, k) || !isComponent(components[k]) || hasOwn(viewComponents, k))
			continue;

		viewComponents[k] = components[k];
	}
}

function isComponent(candidate) {
	return Boolean(candidate) && typeof candidate == "object" && hasOwn(candidate, "_compiled");
}

function wrapComponent(admin, component) {
	if (!component.mixins && !hasOwn(admin.mixins, "default"))
		return admin.wrapperManager.wrap(component);

	component = Object.assign({}, component);
	const mixins = component.mixins ?
		Array.isArray(component.mixins) || [component.mixins] :
		[];

	delete component.mixins;

	component = admin.wrapperManager.wrap(component);

	if (hasOwn(admin.mixins, "default"))
		component.addMixin("default", admin.mixins.default);

	for (let i = 0, l = mixins.length; i < l; i++) {
		if (typeof mixins[i] == "string") {
			if (!hasOwn(admin.mixins, mixins[i]))
				throw new Error(`Cannot resolve mixin '${mixins[i]}': no registered mixin found`);

			component.addMixin(mixins[i], admin.mixins[mixins[i]]);
		} else
			component.addMixin(`injected-mixin-${i}`, mixins[i]);
	}

	return component;
}

function connect(admin, wrapper, meta) {
	wrapper.addData("admin", admin);

	// Connect interfaces
	const interfaces = admin.interfaces;
	for (const k in interfaces) {
		if (!hasOwn(interfaces, k))
			continue;

		const { config } = interfaces[k];

		if (!hasOwn(config, "connect") || typeof config.connect != "function")
			continue;

		config.connect(admin, wrapper, meta);
	}

	// Connect plugins
	const plugins = admin.plugins;
	for (const k in plugins) {
		if (!hasOwn(plugins, k))
			continue;

		const { config } = plugins[k];

		if (!hasOwn(config, "connect") || typeof config.connect != "function")
			continue;

		config.connect(admin, wrapper, meta);
	}
}

function hasInit(supplier) {
	return hasOwn(supplier, "init") && typeof supplier.init == "function";
}

function stripConfigProps(inter, keys) {
	const stripped = {};

	for (const k in inter) {
		if (hasOwn(inter, k) && !hasOwn(keys, k))
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
