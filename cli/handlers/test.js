const path = require("path");
const {
	spawn
} = require("../utils");
const Commander = require("../commander");

const ROOT = path.join(__dirname, "../.."),
	PKG_DIR = path.join(ROOT, "pkg"),
	PKG_PATH = path.relative(PKG_DIR, ""),
	STD_IO = { stdio: "inherit" };

const commands = new Commander({
		guard(cmd, options) {
			if (!PKG_PATH || PKG_PATH.indexOf("..") == 0) {
				console.log("Running all tests");
				spawn("jest", [ROOT, ...options.args]);
				return false;
			}

			return true;
		}
	})
	.cmd("all", options => {
		console.log("Running all tests");
		spawn("jest", ["pkg/", ...options.args.slice(1)], STD_IO);
	})
	.cmd("pkg", options => {
		const pkgName = PKG_PATH.split(path.sep)[0];
		console.log(`Running all tests in package '${pkgName}'`);
		spawn("jest", [path.join("pkg", pkgName), ...options.args.slice(1)], STD_IO);
	});

module.exports = commands;
