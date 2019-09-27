// Build
const chokidar = require("chokidar");
const path = require("path");
const express = require("express");
const {
	join,
	joinDir,
	readdir,
	stat,
	spawn,
	info
} = require("../cli/utils");
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
app.use("/media", express.static(joinDir("web/media")));
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

	info(`Finished building exposed files for ${count} packages (${Date.now() - startTime} ms)`);
})();
