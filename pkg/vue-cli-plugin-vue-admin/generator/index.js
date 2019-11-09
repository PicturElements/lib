const path = require("path");
const fs = require("fs");
const {
	serialize,
	updateJSON,
	pathRelative,
	mkVueRenderer,
	bufferedFileInject
} = require("@qtxr/node-utils");

const getRoutes = require("../data/routes");
const getConfig = require("../data/config");
const getPackage = require("../data/package");

module.exports = function generate(api, settings) {
	const cwd = process.cwd(),
		paths = {
			directory: settings.directory,
			routesFile: path.join(cwd, settings.routeTarget),
			package: path.join(cwd, "package.json"),
			adminRelativePath: pathRelative(
				settings.routeTarget,
				path.join(settings.directory)
			)
		},
		hasPlugin = api.hasPlugin("v-admin"),
		configData = getConfig(),
		args = {
			api,
			settings,
			paths,
			configData,
			indentChar: "\t",
			indentWidth: 4
		},
		render = mkVueRenderer({
			api,
			root: __dirname,
			destTarget: "./templates/buffer"
		});

	if (!fs.existsSync(paths.routesFile))
		throw new Error(`Failed to find routes file at ${paths.routesFile}`);

	const {
		buffer,
		routesTemplate
	} = collectRoutes(args);

	// Add default structure
	render({
		struct: {
			[paths.directory]: "./templates/default"
		},
		templateData: {
			routesTemplate
		}
	});

	// Render routes and views from settings
	render({
		struct: buffer,
		srcTarget: "./templates"
	});

	api.extendPackage(getPackage());

	api.onCreateComplete(async _ => {
		if (!hasPlugin)
			await runInitOnComplete(args);
	});
};

function collectRoutes(args) {
	const {
		paths,
		settings
	} = args;

	const buffer = {},
		routesTemplate = [];

	const traverse = (routes, indent) => {
		for (const route of routes) {
			if (!route.forceRender && settings.views.indexOf(route.name) == -1)
				continue;

			const viewPath = path.join("views", `${route.name}.vue`),
				modelPath = path.join(paths.directory, "models", `${route.name}.js`),
				templatePath = path.join(paths.directory, viewPath);

			buffer[templatePath] = viewPath;
			buffer[modelPath] = {
				fileData: genModel(route)
			};

			routesTemplate.push({
				indent: indent + 1,
				route: route || "/"
			});

			if (route.children)
				traverse(route.children, indent + 1);
		}
	};

	traverse(getRoutes(args), 0);

	return {
		buffer,
		routesTemplate: compileRoutesTemplate(routesTemplate, args)
	};
}

function genModel(route) {
	const modelData = {
		dataCells: {},
		data: {},
		methods: {},
		computed: {},
		props: {},
		components: {},
		meta: {}
	};

	modelData.meta = route.meta;

	if (route.inject)
		Object.assign(modelData, route.inject);

	const out =
`export default ${serialize(modelData, { quote: "" })};
`;

	return out;
}

function compileRoutesTemplate(template, args) {
	const out = [];
	let boundaryIndent = 0;

	for (const row of template) {
		const mainWidth = row.indent * args.indentWidth + row.route.route.length,
			roundedIndent = Math.ceil((mainWidth + 1) / args.indentWidth) * args.indentWidth;
	
		if (roundedIndent > boundaryIndent)
			boundaryIndent = roundedIndent;
	}

	for (const row of template) {
		const mainWidth = row.indent * args.indentWidth + row.route.route.length,
			adjustedIndent = Math.floor(mainWidth / args.indentWidth) * args.indentWidth,
			pad = (boundaryIndent - adjustedIndent) / args.indentWidth;

		out.push(
			args.indentChar.repeat(row.indent) +
			row.route.route + 
			args.indentChar.repeat(pad) +
			row.route.name
		);
	}

	return out.join("\n");
}

async function runInitOnComplete(args) {
	const {
		paths
	} = args;

	// Inject admin routes
	await bufferedFileInject(paths.routesFile, [
		{
			matcher: {
				body: /<script>/,
				post: /<\/script/
			},
			injection: `import admin from "${paths.adminRelativePath}";`,
			mode: "newline",
			indent: "next",
			verticalPad: {
				bottom: 1
			},
			id: "route-import"
		},
		{
			matcher: {
				pre: /(?:Vue)?Router/,
				body: /routes\s*:\s*\[/
			},
			injection: "...admin.getRoutes(),",
			mode: "newline",
			indent: "next",
			id: "route-injection"
		}
	]);

	// Intercept serve script
	updateJSON(paths.package, json => {
		return {
			scripts: {
				serve: `node ${path.join(paths.directory, "runtime/service.js")} & npm run pre-vue-admin-serve`,
				"pre-vue-admin-serve": json.scripts.serve
			}
		};
	}, "  ");
}
