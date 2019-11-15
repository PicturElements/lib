import {
	get,
	resolveVal,
	requestFrame
} from "@qtxr/utils";

export default {
	use(admin, meta, routes) {
		admin.ui.routing = {
			sidebarNav: [],
			breadcrumbs: []
		};

		const rootRoute = routes[0];

		const traverse = route => {
			route.beforeEnter = (to, from, next) => {
				const args = {
					nextRoute: to,
					prevRoute: from,
					route,
					rootRoute,
					admin
				};

				updateTitle(args);
				updateSidebarNav(args);
				updateBreadcrumbs(args);

				next();
			};

			const children = route.children || [];
			for (let i = 0, l = children.length; i < l; i++)
				traverse(children[i]);
		};

		traverse(rootRoute);
	},
	useOnce: true
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

		for (let i = 0, l = routes.length; i < l; i++) {
			const route = routes[i],
				sidebarMeta = get(route, "view.meta.sidebar", {}),
				node = {
					path: resolveParams(route.fullPath, args.nextRoute),
					...matchMatchedRoute(args.nextRoute, route),
					route,
					depth,
					absoluteDepth,
					children: null,
					name: resolveVal(sidebarMeta.name, args),
					display: resolveVal(sidebarMeta.display, args)
				};

			node.children = node.display == "skip" ?
				traverse(route.children, depth, absoluteDepth + 1) :
				traverse(route.children, depth + 1, absoluteDepth + 1);

			switch (node.display) {
				case "skip": {
					for (let j = 0, l2 = node.children.length; j < l2; j++)
						outRoutes.push(node.children[j]);
					break;
				}

				case "active":
					if (node.matched || node.children.length)
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

		return outRoutes;
	};

	args.admin.ui.routing.sidebarNav = traverse([args.rootRoute], 0, 0);
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
