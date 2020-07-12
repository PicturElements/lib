// Build
const chokidar = require("chokidar");
const path = require("path");
const express = require("express");
const {
	join,
	readdir,
	stat,
	spawn,
	info,
	error
} = require("../pkg/node-utils");
const { BuildStamp } = require("../utils");
const { buildExposedAtPkg } = require("./expose");
const routes = require("./routes");

// Server
const app = express();
const PORT = 1234;

const scssStamp = new BuildStamp(),
	pkgStamp = new BuildStamp();

// Build
chokidar
	.watch("web/style/scss/*.scss")
	.on("change", _ => {
		console.log(
			`Compiling SCSS ${scssStamp.verbose()}`
		);

		spawn("sass", ["--update", "web/style/scss:web/style/css"], { stdio: "inherit" });
	});

chokidar
	.watch("pkg")
	.on("change", async p => {
		const pkgName = p.split(path.sep)[1];
		console.log();
		await buildExposedAtPkg(pkgName);
		info(`from ${p} ${pkgStamp.verbose()}`);
	});

// Routes
routes(app);
app.use("/media", express.static(join(__dirname, "../web/media")));
app.use("/style", express.static(join(__dirname, "../web/style/css")));
app.use("/bundles", express.static(join(__dirname, "../web/bundles")));
app.use("/pkg", express.static(join(__dirname, "../pkg")));

app.listen(PORT, _ => console.log(`Visit port ${PORT}.`));

function plural(count, base) {
	return base + (count ? "s" : "");
}

(async _ => {
	console.log("Building exposed files");

	const pkgPath = join(__dirname, "../pkg");
	const pkgDir = await readdir(pkgPath);

	const startTime = Date.now();
	let count = 0,
		errors = 0,
		fatalErrors = 0;

	for (const pkgName of pkgDir) {
		if (pkgName[0] == ".")
			continue;

		const p = join(pkgPath, pkgName);
		const st = await stat(p);

		if (!st || !st.isDirectory())
			continue;

		const statuses = await buildExposedAtPkg(pkgName);

		if (!statuses)
			fatalErrors++;
		else
			errors += statuses.filter(success => !success).length;

		console.log();
		count++;
	}

	info(`Finished building exposed files for ${count} ${plural(count, "package")} (${Date.now() - startTime} ms)`);

	if (errors)
		error(`${errors} ${plural(errors, "error")}`);

	if (fatalErrors)
		error(`${fatalErrors} fatal ${plural(fatalErrors, "error")}`);
})();
