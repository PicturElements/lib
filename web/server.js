// Build
const chokidar = require("chokidar");
const path = require("path");
const express = require("express");
const {
	exists,
	join,
	joinDir,
	readdir,
	stat,
	spawn
} = require("../cli/utils");
const { buildExposedAtPkg } = require("./expose");

// Server
const app = express();
const PORT = 1234;

// Views
const renderPkgPage = require("./views/pkg");
const renderErrorPage = require("./views/error");

let buildCount = 0;

// Build
chokidar
	.watch("style/scss/*.scss")
	.on("change", _ => {
		const date = new Date();

		console.log(
			`Compiling SCSS @${date.getHours()}:${date.getMinutes()} ${date.getMonth() + 1}/${date.getDate()} - build ${++buildCount}`
		);

		spawn("sass", ["--update", "./_style/scss:./_style/css"], { stdio: "inherit" });
	});

chokidar
	.watch("pkg")
	.on("change", p => {
		const pkgName = p.split(path.sep)[1];
		buildExposedAtPkg(pkgName);
	});

// Routes
app.get("/:page?", async (req, res) => {
	const pageName = req.params.page;

	if (pageName && await exists(join("pkg", pageName)))
		renderPkgPage(req, res, pageName);
	else
		renderErrorPage(req, res, pageName);
});

app.use("/style", express.static(joinDir("web/style/css")));
app.use("/bundles", express.static(joinDir("web/bundles")));
app.use("/pkg", express.static(joinDir("pkg")));

app.listen(PORT, _ => console.log(`Visit port ${PORT}.`));

(async _ => {
	console.log("Building exposed files");

	const pkgPath = join(__dirname, "../pkg");
	const pkgDir = await readdir(pkgPath);

	const startTime = Date.now();
	let count = 0;

	for (const pkgName of pkgDir) {
		if (pkgName[0] == ".")
			continue;

		const p = join(pkgPath, pkgName);
		const st = await stat(p);

		if (!st || !st.isDirectory())
			continue;

		await buildExposedAtPkg(pkgName);
		console.log();
		count++;
	}

	console.log(`Finished building exposed files for ${count} packages (${Date.now() - startTime} ms)`);
})();
