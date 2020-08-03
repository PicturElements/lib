import {
	get,
	hasOwn,
	isObject,
	resolveVal
} from "@qtxr/utils";

export default {
	use(admin) {
		admin.ui.routing = {
			// Route URL
			currentRoute: null,
			// VueAdmin route proxies
			proxies: {
				current: null,
				previous: null
			},
			// Vue route objects
			currentRouteObject: null,
			prevRouteObject: null,
			// Public title data
			title: null,
			titleOverrides: [],
			// Public sidebar data
			sidebarNav: [],
			sidebarOverrides: [],
			// Public breadcrumb data
			breadcrumbs: [],
			breadcrumbOverrides: []
		};
	},
	useOnce: true,
	connect(admin, wrapper, meta) {
		// Only apply to view components
		if (meta.type != "view")
			return;

		const dispatchChange = (to, from) => {
			if (to.path == admin.ui.routing.currentRoute)
				return;

			admin.ui.routing.currentRoute = to.path;
			admin.ui.routing.currentRouteObject = to;
			admin.ui.routing.prevRouteObject = from;
			admin.ui.routing.proxies.current = to.meta.route;
			admin.ui.routing.proxies.previous = from.meta.route;

			const args = {
				type: "change",
				nextRoute: to,
				prevRoute: from,
				currentRoute: to,
				route: to.meta.route,
				rootRoute: getRootRoute(to.meta.route),
				admin
			};

			updateTitle(args);
			updateSidebarNav(args);
			updateBreadcrumbs(args);
		};

		wrapper.addWatcher("$route", dispatchChange);
		wrapper.addHook("beforeMount", function() {
			dispatchChange(this.$route, this.$route);
		});

		wrapper.addComputed("ownRoute", function() {
			return getOwnRoute(this);
		});
		wrapper.addComputed("subroutes", function() {
			return getSubroutes(this);
		});
		wrapper.addComputed("exactRoute", function() {
			return this.$route.meta.id == this.ownRoute.meta.id;
		});

		wrapper.addMethod("setTitle", function(overrider, persistent) {
			setOverrider(this, admin.ui.routing.titleOverrides, overrider, persistent);
			updateTitle(mkUpdateArgs(admin));
		});
		wrapper.addMethod("setSidebar", function(overrider, persistent) {
			setOverrider(this, admin.ui.routing.sidebarOverrides, overrider, persistent);
			updateSidebarNav(mkUpdateArgs(admin));
		});
		wrapper.addMethod("setBreadcrumb", function(overrider, persistent) {
			setOverrider(this, admin.ui.routing.breadcrumbOverrides, overrider, persistent);
			updateBreadcrumbs(mkUpdateArgs(admin));
		});
		wrapper.addMethod("setRouteUi", function(overrider, persistent) {
			if (typeof overrider == "string") {
				overrider = {
					title: overrider,
					sidebar: overrider,
					breadcrumb: overrider
				};
			} else if (!isObject(overrider))
				return;

			persistent = typeof overrider.persistent == "boolean" ?
				overrider.persistent :
				persistent;

			const keys = [
				["title", "setTitle"],
				["sidebar", "setSidebar"],
				["breadcrumb", "setBreadcrumb"]
			];

			for (let i = 0, l = keys.length; i < l; i++) {
				if (!hasOwn(overrider, keys[i][0]))
					continue;

				this[keys[i][1]](overrider[keys[i][0]], persistent);
			}
		});
	}
};

function updateTitle(args) {
	const route = args.route,
		accessor = route.accessor;
	let overrides = args.admin.ui.routing.titleOverrides;

	// One of few times where we might want to trigger
	// an update when the tab isn't in focus
	setTimeout(_ => {
		let title = get(args.route, "view.meta.title");

		for (let i = 0, l = accessor.length; i < l; i++) {
			const idx = accessor[i];
	
			if (!overrides[idx])
				overrides[idx] = mkOverriderPartition();
	
			if (i == l - 1) {
				clearOverrides(overrides, idx);
				if (overrides[idx].overrider !== null)
					title = overrides[idx].overrider.name;
			}
	
			overrides = overrides[idx].children;
		}

		title = resolveVal(title, args);

		if (!title)
			return;

		title = String(title);
		document.title = title;
		args.admin.ui.routing.title = title;
	}, 0);
}

function updateSidebarNav(args) {
	const traverse = (routes, overrides, depth, absoluteDepth) => {
		if (!routes)
			return [];

		const outRoutes = [];
		let hasActiveRoute = false;

		for (let i = 0, l = routes.length; i < l; i++) {
			if (!overrides[i])
				overrides[i] = mkOverriderPartition();

			const route = routes[i],
				sidebarMeta = Object.assign(
					{},
					get(route, "view.meta.sidebar"),
					overrides[i].overrider
				),
				node = {
					...matchMatchedRoute(args.nextRoute, route),
					path: resolveParams(route.fullPath, args.nextRoute),
					activeRoute: false,
					route,
					depth,
					absoluteDepth,
					children: null,
					name: resolveVal(sidebarMeta.name, args),
					display: resolveVal(sidebarMeta.display, args)
				},
				traversalData = node.display == "skip" ?
					traverse(route.children, overrides[i].children, depth, absoluteDepth + 1) :
					traverse(route.children, overrides[i].children, depth + 1, absoluteDepth + 1);

			if (node.active)
				clearOverrides(overrides, i);

			node.children = traversalData.routes;
			node.activeRoute = traversalData.hasActiveRoute || (node.matched && node.active);
			node.active = node.active || (node.activeRoute && !node.children.length);

			hasActiveRoute = node.activeRoute || hasActiveRoute;

			switch (node.display) {
				case "skip": {
					for (let j = 0, l2 = node.children.length; j < l2; j++)
						outRoutes.push(node.children[j]);
					break;
				}

				case "active":
					if (node.activeRoute)
						outRoutes.push(node);
					break;

				case "hidden":
				case false:
					break;

				case "visible":
				case true:
				default:
					outRoutes.push(node);
			}
		}

		return {
			routes: outRoutes,
			hasActiveRoute
		};
	};

	args.admin.ui.routing.sidebarNav = traverse(
		[args.rootRoute],
		args.admin.ui.routing.sidebarOverrides,
		0,
		0
	).routes;
}

function updateBreadcrumbs(args) {
	const breadcrumbs = args.route.breadcrumbs,
		accessor = args.route.accessor,
		outBreadcrumbs = [];
	let overrides = args.admin.ui.routing.breadcrumbOverrides;

	for (let i = 0, l = breadcrumbs.length; i < l; i++) {
		const idx = accessor[i];

		if (!overrides[idx])
			overrides[idx] = mkOverriderPartition();

		if (i == l - 1)
			clearOverrides(overrides, idx);

		const crumb = Object.assign(
			{},
			breadcrumbs[i],
			overrides[idx].overrider
		);
		crumb.path = resolveParams(crumb.path, args.nextRoute);
		crumb.display = resolveVal(crumb.display, args) || "visible";
		crumb.name = resolveVal(crumb.name, args);

		switch (crumb.display) {
			case "hidden":
			case false:
				break;

			case "visible":
			case true:
			default:
				outBreadcrumbs.push(crumb);
		}

		overrides = overrides[idx].children;
	}

	args.admin.ui.routing.breadcrumbs = outBreadcrumbs;
}

// %%%%%% UTILS %%%%%%
function mkOverriderPartition() {
	return {
		children: [],
		overrider: null
	};
}

function setOverrider(vm, overrides, overrider, persistent = null, factory = null) {
	const route = getOwnRoute(vm);

	if (!route || !route.accessor)
		return null;

	if (typeof overrider == "string" || typeof overrider == "function") {
		overrider = {
			name: overrider
		};
	} else if (!isObject(overrider))
		return null;

	const accessor = route.accessor;
	let overriderPartition = null;

	for (let i = 0, l = accessor.length; i < l; i++) {
		const idx = accessor[i];

		if (!overrides[idx]) {
			const partition = typeof factory == "function" ?
				factory() :
				{};

			partition.children = [];
			partition.overrider = null;
			overrides[idx] = partition;
		}

		overriderPartition = overrides[idx];
		overrides = overrides[idx].children;
	}

	if (!overriderPartition)
		return null;

	overriderPartition.overrider = overrider;
	overrider.persistent = typeof persistent == "boolean" ?
		persistent :
		overrider.persistent || false;
	return overriderPartition;
}

function clearOverrides(overrides, idx) {
	for (let i = 0, l = overrides.length; i < l; i++) {
		const child = overrides[i];

		if (!child)
			continue;

		if (i !== idx && (!child.overrider || !child.overrider.persistent))
			child.overrider = null;

		clearOverrides(child.children, -1);
	}
}

function matchMatchedRoute(route, node) {
	const nodeId = node.meta.id,
		matched = route.matched;

	for (let i = 0, l = matched.length; i < l; i++) {
		const id = matched[i].meta.id;

		if (id == nodeId) {
			return {
				matched: true,
				active: i == matched.length - 1
			};
		}
	}

	return {
		matched: false,
		active: false
	};
}

function resolveParams(path, nextRoute) {
	return path.replace(/:(\w+)/g, (match, key) => {
		if (!hasOwn(nextRoute.params, key))
			return match;

		return nextRoute.params[key];
	});
}

function getRootRoute(route) {
	while (true) {
		if (!route.parent)
			return route;

		route = route.parent;
	}
}

function getOwnRoute(vm) {
	const matched = vm.$route.matched;

	for (let i = matched.length - 1; i >= 0; i--) {
		const match = matched[i];

		for (const k in match.instances) {
			if (hasOwn(match.instances, k) && match.instances[k] == vm)
				return match.meta.route;
		}
	}

	return null;
}

function getSubroutes(vm) {
	const route = getOwnRoute(vm);
	if (!route)
		return [];

	const children = route.meta.route.children,
		outChildren = [];

	for (let i = 0, l = children.length; i < l; i++) {
		const child = children[i],
			outRoute = {
				route: child
			},
			linkConfig = child.linkConfig,
			navConfig = child.sidebarConfig,
			args = {
				route,
				rootRoute: getRootRoute(route),
				admin: vm.admin
			};

		outRoute.path = resolveParams(child.fullPath, vm.$route);
		outRoute.name = resolveVal(linkConfig.name || navConfig.name, args);
		outRoute.display = resolveVal(linkConfig.display, args) || "visible";

		switch (outRoute.display) {
			case "hidden":
			case false:
				break;

			case "visible":
			case true:
			default:
				outChildren.push(outRoute);
		}
	}

	return outChildren;
}

function mkUpdateArgs(admin) {
	const currentRoute = admin.ui.routing.currentRouteObject;

	return {
		type: "update",
		nextRoute: currentRoute,
		prevRoute: admin.ui.routing.prevRouteObject,
		currentRoute,
		route: currentRoute.meta.route,
		rootRoute: getRootRoute(currentRoute.meta.route),
		admin
	};
}
