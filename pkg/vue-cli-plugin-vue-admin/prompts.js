const getRoutes = require("./data/routes");
const routes = getRoutes();

function viewChoices() {
	const choicesOut = [];

	const traverse = (route, indent, last) => {
		if (!route.forceRender) {
			let prefix = "";

			if (indent > 0)
				prefix = "   ".repeat(indent - 1) + (last ? "└─ " : "├─ ");

			const choice = {
				name: prefix + route.choiceName,
				value: route.name,
				short: route.choiceName
			};
		
			choicesOut.push(choice);
		}

		const children = route.children || [];
		for (let i = 0, l = children.length; i < l; i++) {
			const child = children[i];
			
			traverse(
				child,
				route.forceRender ? indent : indent + 1,
				i == l - 1
			);
		}
	};

	for (const route of routes)
		traverse(route, 0, true);

	return choicesOut;
}

module.exports = [
	{
		name: "directory",
		type: "input",
		message: "Admin directory",
		default: "src/admin"
	},
	{
		name: "url",
		type: "input",
		message: "Admin section URL",
		default: "/admin"
	},
	{
		name: "routeTarget",
		type: "input",
		message: "Routes file (Where routing is defined)",
		default: "src/app.vue"
	},
	{
		name: "views",
		type: "checkbox",
		message: "Select views to auto-generate",
		choices: viewChoices,
		default: [
			"dashboard",
			"view-manager"
		]
	}
];
