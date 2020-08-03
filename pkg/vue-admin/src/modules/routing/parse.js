import {
	get,
	hasOwn,
	isObject,
	parseTreeStr
} from "@qtxr/utils";
import URL from "@qtxr/url";

const routeViewIdRegex = /([^\s>]+)(?:\s*((?:[\w-]+(?:\s+as\s+[\w-]+)?)(?:\s*,\s*[\w-]+(?:\s+as\s+[\w-]+)?)*))?/,
	viewIdResolveRegex = /([\w-]+)\/?$/;

export default function parseRoutes(inst, routeTree) {
	const traverse = (children, depth, accumulator) => {
		const routes = [];

		for (let i = 0, l = children.length; i < l; i++) {
			const child = children[i],
				route = {
					path: null,
					fullPath: null,
					accessor: accumulator.accessor.concat(i),
					breadcrumbs: [],
					children: [],
					depth,
					parent: accumulator.parent,
					root: null,
					meta: {
						id: `${accumulator.id}-${i}`
					}
				};

			const resolveViewComponent = id => {
				if (!hasOwn(inst.viewComponents, id))
					throw new Error(`Failed to route: '${id}' is not a known view component`);

				return inst.viewComponents[id];
			};

			const resolveView = id => {
				if (!hasOwn(inst.views, id))
					throw new Error(`Failed to route: '${id}' is not a known view`);

				return inst.views[id];
			};

			if (child.hasNamedRoutes || child.componentData.length > 1) {
				const components = {},
					views = {};

				for (let i = 0, l = child.componentData.length; i < l; i++) {
					const data = child.componentData[i];
					components[data.name || data.id] = resolveViewComponent(data.id);
					views[data.name || data.id] = resolveView(data.id);
				}

				route.components = components;
				route.views = views;
			} else {
				route.component = resolveViewComponent(child.componentData[0].id);
				route.view = resolveView(child.componentData[0].id);
			}

			// Remove any special characters off route paths
			// more than one level deep to comply with VR's structure
			route.isBaseRoute = child.path[0] == "/";
			route.root = accumulator.root || route;
			route.path = cleanPathComponent(child.path, depth) || "";
			route.fullPath = URL.join(accumulator.fullPath, route.path) || "/";
			route.meta.route = route;
			route.specificity = calculatePathSpecificity(route.fullPath);

			const view = getView(route);
			let crumb = get(view, "meta.breadcrumb", {}) || cleanBreadcrumb(route.path);

			route.sidebarConfig = get(view, "meta.sidebar", {});
			route.breadcrumbConfig = get(view, "meta.breadcrumb", {});
			route.linkConfig = get(view, "meta.link", {});

			if (!isObject(crumb)) {
				crumb = {
					name: crumb
				};
			}

			crumb = Object.assign({
				path: route.fullPath,
				route
			}, crumb);

			route.breadcrumbs = [...accumulator.breadcrumbs, crumb];

			inst.routesMap[route.meta.id] = route;
			routes.push(route);

			route.children = traverse(child.children, depth + 1, {
				fullPath: route.fullPath,
				accessor: route.accessor,
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
		fullPath: "/",
		accessor: [],
		breadcrumbs: [],
		parent: null,
		id: "route"
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

// Specificity:
// 0:	wildcard (least specific)
// 1:	parameter (more specific)
// 2:	exact match (most specific)
// Longer specificity arrays are more specific,
// and outputted routes are sorted by most specific first.
// Similarly, specificity are big-endian and are evaluated
// cell by cell
function calculatePathSpecificity(path) {
	const components = path.replace(/^\.?\//, "").split("/"),
		specificity = [];

	for (let i = 0, l = components.length; i < l; i++) {
		const component = components[i];
		let specificityComponent = 2;

		if (component.indexOf(":") == 0)
			specificityComponent = 1;

		if (/\*/.test(component))
			specificityComponent = 0;

		specificity.push(specificityComponent);
	}

	return specificity;
}
