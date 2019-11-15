import URL from "@qtxr/url";

export default function extractRoutes(routes, baseRoutes, path) {
	const outRoutes = [];

	for (let i = 0, l = routes.length; i < l; i++) {
		const route = Object.assign({}, routes[i]),
			rPath = route.path,
			origChildren = route.children;

		if (route.isBaseRoute)
			outRoutes.push(route);
		else {
			if (!baseRoutes)
				throw new Error(`Cannot route: only base routes are allowed at root level (at '${route.fullPath}')`);
			
			route.path = URL.join(path, route.path);
			baseRoutes.push(route);
		}

		route.children = extractRoutes(
			origChildren,
			route.isBaseRoute ? outRoutes : baseRoutes,
			route.isBaseRoute ? route.path : URL.join(path, rPath)
		);
	}

	return outRoutes;
}
