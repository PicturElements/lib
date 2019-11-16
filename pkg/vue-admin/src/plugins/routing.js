import {
	get,
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
		// Don't apply to normal components
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
		if (!nextRoute.params.hasOwnProperty(key))
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
