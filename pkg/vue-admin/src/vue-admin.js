import {
	hasOwn,
	isObject,
	forEach,
	resolveArgs,
	parseTreeStr
} from "@qtxr/utils";

import URL from "@qtxr/url";
import wc from "@qtxr/vue-wrap-component";
import { CustomJSON } from "@qtxr/uc";
import { Hookable } from "@qtxr/bc";
import { devWarn } from "./dev";

import AdminView from "./admin-view";
import * as suppliers from "./suppliers";

const validViewIdRegex = /^[\w-]+$/,
	routeViewIdRegex = /([^\s>]+)(?:\s*((?:[\w-]+(?:\s+as\s+[\w-]+)?)(?:\s*,\s*[\w-]+(?:\s+as\s+[\w-]+)?)*))?/,
	viewIdResolveRegex = /([\w-]+)\/?$/;

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
		this.components = {};
		this.viewCount = 0;
		this.config = config;
		this.routes = [];
		this.routesMap = {};
		this.initialized = false;
		this.interfaces = {};
		this.methods = {};
		this.inject = {
			components: {}
		};

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

	init(data = {}) {
		if (this.initialized)
			return;

		if (data.components)
			this.inject.components = data.components;

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

		this.components[id] = component;
		this.views[id] = view;
		this.viewCount++;
		return this;
	}
	
	route(routeTree) {
		this.routes = collectRoutes(this, routeTree);
	}

	getRoutes() {
		const traverse = (routes, baseRoutes, path) => {
			const outRoutes = [];

			for (let i = 0, l = routes.length; i < l; i++) {
				const route = Object.assign({}, routes[i]),
					origChildren = route.children;

				if (route.isBaseRoute)
					outRoutes.push(route);
				else {
					if (!baseRoutes)
						throw new Error(`Cannot route: only base routes are allowed at root level (ar '${route.fullPath}')`);
					
					route.path = URL.join(path, route.path);
					baseRoutes.push(route);
				}

				route.children = traverse(
					origChildren,
					route.isBaseRoute ? outRoutes : baseRoutes,
					route.isBaseRoute ? route.path : URL.join(path, route.path)
				);
			}

			return outRoutes;
		};

		const routes = traverse(this.routes, null, "");
		console.log(routes);
		return routes;
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

		view.components = resolveComponents(this, view.components);

		const wrapper = wc.wrap(view);
		this.views[idOrComponent].connect(wrapper);
		connect(this, wrapper);
		return wrapper;
	}

	wrapC(component) {
		if (!isObject(component))
			throw new Error(`Cannot wrap component: supplied component is not a component object`);

		component.components = resolveComponents(this, component.components);

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
			throw new Error(`Cannot supply: interfaceName (${interfaceName}) is not valid`);
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

function resolveComponents(admin, components) {
	components = Object.assign({}, components);

	const baseComponents = {},
		scope = components.scope || "";

	delete components.scope;

	const traverse = comps => {
		forEach(comps, (comp, name) => {
			if (comp._compiled)
				baseComponents[name] = comp;
			else if (isObject(comp))
				traverse(comp);
		});
	};

	traverse(admin.inject.components);

	return Object.assign(baseComponents, components);
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

function collectRoutes(inst, routeTree) {
	const traverse = (children, depth, accumulator) => {
		const routes = [];

		for (let i = 0, l = children.length; i < l; i++) {
			const child = children[i],
				route = {
					path: null,
					fullPath: null,
					breadcrumbs: [],
					children: [],
					depth,
					parent: accumulator.parent,
					root: null,
					meta: {
						id: accumulator.id + (depth ? `-${i}` : String(i))
					}
				};

			const resolveComponent = id => {
				if (!inst.components.hasOwnProperty(id))
					throw new Error(`Failed to route: '${id}' is not a known component`);

				return inst.components[id];
			};

			const resolveView = id => {
				if (!inst.views.hasOwnProperty(id))
					throw new Error(`Failed to route: '${id}' is not a known view`);

				return inst.views[id];
			};

			if (child.hasNamedRoutes || child.componentData.length > 1) {
				const components = {},
					views = {};

				for (let i = 0, l = child.componentData.length; i < l; i++) {
					const data = child.componentData[i];
					components[data.name || data.id] = resolveComponent(data.id);
					views[data.name || data.id] = resolveView(data.id);
				}

				route.components = components;
				route.views = views;
			} else {
				route.component = resolveComponent(child.componentData[0].id);
				route.view = resolveView(child.componentData[0].id);
			}

			// Remove any special characters off route paths
			// more than one level deep to comply with VR's structure
			route.isBaseRoute = child.path[0] == "/";
			route.root = accumulator.root || route;
			route.path = cleanPathComponent(child.path, depth) || "/";
			route.fullPath = URL.join(accumulator.fullPath, route.path) || "/";
			route.meta.route = route;

			const view = getView(route),
				crumb = view && view.meta.breadcrumb || cleanBreadcrumb(route.path);

			// Don't include empty crumbs
			if (crumb && typeof crumb == "string") {
				route.breadcrumbs = [...accumulator.breadcrumbs, {
					path: route.fullPath,
					crumb
				}];
			} else if (crumb && typeof crumb == "object" && crumb.display == "visible"){
				route.breadcrumbs = [...accumulator.breadcrumbs, {
					path: route.fullPath,
					crumb: crumb.name
				}];
			} else
				route.breadcrumbs = accumulator.breadcrumbs;

			inst.routesMap[route.meta.id] = route;
			routes.push(route);

			route.children = traverse(child.children, depth + 1, {
				fullPath: route.fullPath,
				breadcrumbs: route.breadcrumbs,
				parent: route,
				root: route.root,
				id: route.meta.id
			});
		}

		return routes;
	};

	const tree = parseRouteTree(routeTree);

	if (tree.length != 1)
		throw new Error(`Failed to route: root must only be one route (${tree.length} roots found)`);

	return traverse(tree, 0, {
		fullPath: "",
		breadcrumbs: [],
		parent: null,
		id: "route-"
	});
}

function parseRouteTree(routeTree) {
	return parseTreeStr(routeTree, {
		process(item) {
			const ex = routeViewIdRegex.exec(item.raw);
			if (!ex)
				throw SyntaxError(`Invalid route item '${item.raw}'`);

			let path = ex[1],
				id = ex[2];

			if (!id) {
				const resolved = viewIdResolveRegex.exec(path);
				id = resolved && resolved[1];
			}

			if (!id)
				throw new Error(`Failed to resolve view ID from route (at '${item.raw}')`);

			let hasNamedRoutes = false;

			const componentData = id.split(/\s*,\s*/).map(comp => {
				const idNameSplit = comp.split(/\s+as\s+/),
					data = {
						id: idNameSplit[0],
						name: idNameSplit[1] || null
					};

				hasNamedRoutes = hasNamedRoutes || (data.name && data.name != "default");

				return data;
			});

			item.hasNamedRoutes = hasNamedRoutes;
			item.componentData = componentData;
			item.path = path;
		}
	});
}

function cleanPathComponent(pth, depth) {
	return depth ? pth.replace(/^\.*\//, "") : pth;
}

function cleanBreadcrumb(pth) {
	return pth.replace(/^\.*\//, "").replace(/\/$/, "");
}

function getView(route) {
	if (route.view)
		return route.view;

	if (route.views && route.views.default)
		return route.views.default;

	return null;
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

function noop() {}
