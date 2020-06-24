import {
	get,
	hasOwn,
	resolveVal,
	requestFrame
} from "@qtxr/utils";

export default {
	use(admin) {
		admin.ui.routing = {
			currentRoute: null,
			sidebarNav: [],
			breadcrumbs: []
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

			const args = {
				nextRoute: to,
				prevRoute: from,
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
	}
};

function updateTitle(args) {
	requestFrame(_ => {
		const title = get(args.route, "view.meta.title");
	
		if (title)
			document.title = resolveVal(title, args);
	});
}

function updateSidebarNav(args) {
	const traverse = (routes, depth, absoluteDepth) => {
		if (!routes)
			return [];

		const outRoutes = [];
		let hasActiveRoute = false;

		for (let i = 0, l = routes.length; i < l; i++) {
			const route = routes[i],
				sidebarMeta = get(route, "view.meta.sidebar", {}),
				node = {
					path: resolveParams(route.fullPath, args.nextRoute),
					...matchMatchedRoute(args.nextRoute, route),
					activeRoute: false,
					route,
					depth,
					absoluteDepth,
					children: null,
					name: resolveVal(sidebarMeta.name, args),
					display: resolveVal(sidebarMeta.display, args)
				},
				traversalData = node.display == "skip" ?
					traverse(route.children, depth, absoluteDepth + 1) :
					traverse(route.children, depth + 1, absoluteDepth + 1);

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

	args.admin.ui.routing.sidebarNav = traverse([args.rootRoute], 0, 0).routes;
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

function updateBreadcrumbs(args) {
	const breadcrumbs = args.route.breadcrumbs,
		outBreadcrumbs = [];

	for (let i = 0, l = breadcrumbs.length; i < l; i++) {
		const crumb = Object.assign({}, breadcrumbs[i]);
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
	}

	args.admin.ui.routing.breadcrumbs = outBreadcrumbs;
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
