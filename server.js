// Build
const chokidar = require("chokidar");
const { spawn } = require("child_process");

const webpack = require("webpack");
// const config = require("./webpack.config");

let buildCount = 0;

// Server
const fs = require("fs");
const express = require("express");
const path = require("path");
const pug = require("pug");

const app = express();
const port = 1234;

// Build
chokidar
	.watch("_style/scss/*.scss")
	.on("change", _ => {
		const date = new Date();

		console.log(
			`Compiling SASS @${date.getHours()}:${date.getMinutes()} ${date.getMonth() + 1}/${date.getDate()} - build ${++buildCount}`
		);

		spawn("sass", ["--update", "./_style/scss:./_style/css"], { stdio: "inherit" });
	});

/*chokidar
	.watch("./static/js", {
		ignored: ["./static/js/bundles"],
	})
	.on("change", buildWebpack);

function buildWebpack() {
	webpack(config, (err, stats) => {
		if (err || stats.hasErrors())
			console.log("ERROR: ", err);
		else
			console.log("Successfully built bundles");
	});
}*/

console.log("Started watchers");
// buildWebpack();

// Server
app.get("/lib/:page?", async (req, res) => {
	const pageName = req.params.page;

	if (pageName && await exists(join("lib", pageName)))
		renderLibPage(req, res, pageName);
	else
		renderErrorPage(req, res, pageName);
});

async function renderLibPage(req, res, pageName) {
	const root = joinDir("lib", pageName);
	const docPath = await findUrl(join(root, "index.pug"), joinDir("defaults/index.pug"));
	const meta = await readMeta(join(root, "meta.json"));

	const compiled = pug.compileFile(docPath, {
			self: true
		}),
		locals = {
			meta,
			title: pageName,
			scripts: [],
			styles: [],
			alerts: []
		};

	await resolveExposedFiles(join("lib", pageName), meta, locals);

	res.send(compiled(locals));
}

function renderErrorPage(req, res, pageName) {
	res.send("error");
}

async function resolveExposedFiles(root, meta, locals) {
	if (!meta.expose)
		return;

	const scripts = meta.expose.scripts,
		styles = meta.expose.styles;

	if (Array.isArray(scripts)) {
		for (const script of scripts)
			await tryResolve(script, /^m?js$/, locals.scripts, "script");
	}

	if (Array.isArray(styles)) {
		for (const style of styles)
			await tryResolve(style, /^(s?c|le)ss$/, locals.styles, "stylesheet");
	}

	async function tryResolve(src, extRegex, list, type) {
		const ex = typeof src == "string" ? /\.(\w{1,6})$/.exec(src) : null;
		if (!ex) {
			locals.alerts.push({
				text: `Source error: '${src}' is not a valid file path`,
				type: "error"
			});
			return;
		}

		const extension = ex[1];

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

		list.push({
			extension,
			src: join("/", root, src)
		});
	}
}

function exists(url) {
	return new Promise(resolve => {
		fs.access(url, fs.constants.F_OK, err => resolve(!err));
	});
}

function join(...paths) {
	return path.join(...paths);
}

function joinDir(...paths) {
	return path.join(__dirname, ...paths);
}

async function findUrl(...urls) {
	for (const url of urls) {
		if (await exists(url))
			return url;
	}

	return null;
}

// Intended to open a descriptor for R/W and prevent race conditions, as
// specified here: https://nodejs.org/api/fs.html#fs_fs_access_path_mode_callback
async function findFileDescriptor(...urls) {
	for (const url of urls) {
		const descriptor = await getFileDescriptor(url);

		if (descriptor > -1)
			return descriptor;
	}

	return -1;
}

function getFileDescriptor(url, flags = "r", mode = 0o666) {
	return new Promise(resolve => {
		fs.open(url, flags, mode, (err, descriptor) => resolve(err ? -1 : descriptor));
	});
}

function closeFile(descriptor) {
	return new Promise(resolve => {
		fs.close(descriptor, err => resolve(!err));
	});
}

async function readFile(...urls) {
	const descriptor = await findFileDescriptor(...urls);
	const buffer = await readFileHelper(descriptor);
	await closeFile(descriptor);
	return buffer;
}

async function readFileUTF(...urls) {
	const descriptor = await findFileDescriptor(...urls);
	const data = await readFileHelper(descriptor, "utf8");
	await closeFile(descriptor);
	return data;
}

// Recommended: supply a file descriptor as the accessor
function readFileHelper(accessor, encoding = null) {
	return new Promise(resolve => {
		if (typeof accessor == "number" && accessor < 0)
			return resolve(null);

		fs.readFile(accessor, encoding, (err, data) => resolve(err ? null : data));
	});
}

async function readMeta(...urls) {
	return JSON.parse(await readFileUTF(...urls)) || {};
}

app.use("/style", express.static(joinDir("style/css")));
app.use("/lib", express.static(joinDir("lib")));

app.listen(port, _ => console.log(`Visit port ${port}.`));
