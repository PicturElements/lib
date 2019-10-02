const {
	join,
	joinDir,
	exists,
	readJSONNull,
	spawn,
	error,
	success
} = require("../utils");
const Commander = require("../commander");

const STD_IO = { stdio: "inherit" };

const commands = new Commander()
	.cmd("install", async options => {
		const [ pkgName, ...passedArgs ] = options.args;

		if (!await isValidPkgName(pkgName, "install"))
			return false;

		const path = joinDir("pkg", pkgName);
		const package = await readJSONNull(join(path, "package.json"));

		if (!package) {
			error("Failed to run uninstall: package.json not readable");
			return false;
		}
		
		const exit = await spawn("npm", [
			"i",
			package.name,
			...passedArgs
		], STD_IO);

		if (exit.code) {
			error(`Failed to run install on ${package.name} (exit code ${exit.code})`);
			return false;
		}
		
		success(`Sucessfully installed ${package.name}`);
	})
	.cmd("local-install", async options => {
		const [ pkgName ] = options.args;

		if (!await isValidPkgName(pkgName, "local-install"))
			return false;

		const exit = await spawn("npm", [
			"i",
			"-D",
			`file:${joinDir("pkg", pkgName)}`
		], STD_IO);

		if (exit.code) {
			error(`Failed to run local-install (exit code ${exit.code})`);
			return false;
		}
	})
	.cmd("local-uninstall", async options => {
		const [ pkgName ] = options.args;

		if (!await isValidPkgName(pkgName, "local-uninstall"))
			return false;

		const path = joinDir("pkg", pkgName);
		const package = await readJSONNull(join(path, "package.json"));

		if (!package) {
			error("Failed to run local-uninstall: package.json not readable");
			return false;
		}
		
		const exit = await spawn("npm", [
			"uninstall",
			"-D",
			package.name
		], STD_IO);

		if (exit.code) {
			error(`Failed to run local-uninstall on ${package.name} (exit code ${exit.code})`);
			return false;
		}
		
		success(`Sucessfully uninstalled ${package.name}`);
	});

async function isValidPkgName(pkgName, cmd) {
	if (!pkgName) {
		error(`Failed to run ${cmd}: package name not given`);
		return false;
	}

	const path = joinDir("pkg", pkgName);

	if (!await exists(path)) {
		error(`Failed to run ${cmd}: ${pkgName} is not a package`);
		return false;
	}

	return true;
}

module.exports = commands;
