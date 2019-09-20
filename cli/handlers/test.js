const path = require("path");
const {
	spawn
} = require("../utils");

const ROOT = path.join(__dirname, "../.."),
	PKG_DIR = path.join(ROOT, "pkg"),
	STD_IO = { stdio: "inherit" };

module.exports = async function test(options, cmd) {
	const pkgPath = path.relative(PKG_DIR, "");

	// Run globally
	if (!pkgPath || pkgPath.indexOf("..") == 0) {
		console.log("Running all tests");
		spawn("jest", [ROOT, ...options.args]);
		return;
	}

	const pkgName = pkgPath.split(path.sep)[0];
	
	switch(cmd) {
		case "all":
			console.log("Running all tests");
			spawn("jest", ["pkg/", ...options.args.slice(1)], STD_IO);
			break;
		case "pkg":
			console.log(`Running all tests in package '${pkgName}'`);
			spawn("jest", [path.join("pkg", pkgName), ...options.args.slice(1)], STD_IO);
			break;
		default:
			spawn("jest");
	}
};
