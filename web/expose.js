const webpack = require("webpack");
const {
	join,
	exists,
	readJSON
} = require("../cli/utils");

const BUNDLE_EXT_MAP = {
	js: "js",
	mjs: "js",
	scss: "css"
};

function buildExposed(pkgName, locals) {
	return Promise.all([
		buildExposedPartition(pkgName, "scripts", locals),
		buildExposedPartition(pkgName, "styles", locals)
	]);
}

async function buildExposedPartition(pkgName, exposeType, locals) {
	return new Promise(resolve => {
		const partition = locals[exposeType],
			startTime = Date.now();
		let count = 0;

		if (!partition || !partition.length)
			return resolve(true);

		const options = {
			mode: "development",
			entry: {},
			output: {
				filename: "[name].js",
				path: join(__dirname, "bundles", pkgName, exposeType)
			}
		};

		for (const item of partition) {
			if (!item.hasOwnProperty("entry"))
				continue;

			options.entry[item.fileName] = join(__dirname, "..", item.entry);
			count++;
		}

		if (!count)
			resolve(true);

		webpack(options, (err, stats) => {
			if (err || stats.hasErrors()) {
				console.log("ERROR: ", err);
				resolve(false);
			} else {
				resolve(true);
				console.log(`${exposeType}@${pkgName}: built ${count} file${count == 1 ? "" : "s"} (${Date.now() - startTime} ms)`);
			}
		});
	});
}

async function resolveLocals(pkgName, package) {
	const locals = {
		package,
		title: pkgName,
		scripts: [],
		entries: [],
		styles: [],
		alerts: []
	};

	if (!package.qlib || !package.qlib.expose)
		return locals;

	const root = join("pkg", pkgName),
		expose = package.qlib.expose,
		scripts = expose.scripts,
		styles = expose.styles;

	if (Array.isArray(scripts)) {
		for (const script of scripts)
			await tryResolve(script, /^m?js$/, "scripts", "script");
	}

	if (Array.isArray(styles)) {
		for (const style of styles)
			await tryResolve(style, /^(s?c|le)ss$/, "styles", "stylesheet");
	}

	async function tryResolve(src, extRegex, exposeType, type) {
		const ex = typeof src == "string" ? /(\w+)\.(\w{1,6})$/.exec(src) : null;

		if (!ex) {
			locals.alerts.push({
				text: `Source error: '${src}' is not a valid file path`,
				type: "error"
			});

			return;
		}

		const fileName = ex[1],
			extension = ex[2];

		if (extRegex && !extRegex.test(extension)) {
			locals.alerts.push({
				text: `Extension error: '${src}' (${extension}) is not a recognized ${type} file`,
				type: "error"
			});

			return;
		}

		if (!await exists(join(root, src))) {
			locals.alerts.push({
				text: `Source error: cannot access '${src}'`,
				type: "error"
			});

			return;
		}

		pushExposed(locals, pkgName, exposeType, {
			fileName,
			extension,
			src: join("/", root, src)
		});
	}

	return locals;
}

function pushExposed(locals, pkgName, exposeType, item) {
	const list = locals[exposeType];

	// Reroute to bundled version
	if (BUNDLE_EXT_MAP.hasOwnProperty(item.extension)) {
		item.extension = BUNDLE_EXT_MAP[item.extension];
		item.entry = item.src;
		item.src = join("/bundles", pkgName, exposeType, `${item.fileName}.${item.extension}`);
	}

	list.push(item);
}

async function buildExposedAtPkg(pkgName, pkg = null) {
	const jsonPath = join("pkg", pkgName, "package.json"),
		startTime = Date.now();

	if (!pkg) {
		if (!pkg && !await exists(jsonPath))
			return console.log(`Couldn't find package.json file for '${pkgName}'`);

		pkg = await readJSON(jsonPath);
	}
	
	const locals = await resolveLocals(pkgName, pkg);
	await buildExposed(pkgName, locals);

	console.log(`Built exposed files for package '${pkgName}' (${Date.now() - startTime} ms)`);
}

module.exports = {
	buildExposed,
	buildExposedPartition,
	resolveLocals,
	buildExposedAtPkg
};
