const {
	join,
	exists,
	readJSONNull,
	spawn,
	error,
	success
} = require("../../pkg/node-utils");
const Commander = require("../commander");

const STD_IO = { stdio: "inherit" };

const commands = new Commander()
	.cmd("install", async options => {
		const [ pkgName, ...passedArgs ] = options.args;
		if (!pkgName) {
			error("Failed to install: no package name provided");
			return false;
		}

		const pth = join(__dirname, "../../pkg", pkgName);

		if (!await isValidPkgName(pkgName, "install"))
			return false;

		if (!await exists(join(pth, "package.json"))) {
			error("Failed to install: couldn't find package.json");
			return false;
		}

		const pkg = await readJSONNull(join(pth, "package.json"));

		if (!pkg) {
			error("Failed to run install: package.json not readable");
			return false;
		}

		const exit = await spawn("npm", [
			"i",
			pkg.name,
			...passedArgs
		], STD_IO);

		if (exit.code) {
			error(`Failed to run install on ${pkg.name} (exit code ${exit.code})`);
			return false;
		}

		success(`Sucessfully installed ${pkg.name}`);
	})
	.cmd("local-install", async options => {
		const [ pkgName ] = options.args,
			pth = join(__dirname, "../../pkg", pkgName);

		if (!await isValidPkgName(pkgName, "local-install"))
			return false;

		if (!await exists(join(pth, "package.json"))) {
			error("Failed to local-install: couldn't find package.json");
			return false;
		}

		const pkg = await readJSONNull(join(pth, "package.json"));

		if (!pkg) {
			error("Failed to run local-install: package.json not readable");
			return false;
		}

		const exit = await spawn("npm", [
			"i",
			"-D",
			`file:${pth}`
		], STD_IO);

		if (exit.code) {
			error(`Failed to run local-install (exit code ${exit.code})`);
			return false;
		}

		success(`Sucessfully installed ${pkg.name}`);
	})
	.cmd("local-uninstall", async options => {
		const [ pkgName ] = options.args;

		if (!await isValidPkgName(pkgName, "local-uninstall"))
			return false;

		const pth = join(__dirname, "../../pkg", pkgName);
		const pkg = await readJSONNull(join(pth, "package.json"));

		if (!pkg) {
			error("Failed to run local-uninstall: package.json not readable");
			return false;
		}

		const exit = await spawn("npm", [
			"uninstall",
			"-D",
			pkg.name
		], STD_IO);

		if (exit.code) {
			error(`Failed to run local-uninstall on ${pkg.name} (exit code ${exit.code})`);
			return false;
		}

		success(`Sucessfully uninstalled ${pkg.name}`);
	});

async function isValidPkgName(pkgName, cmd) {
	if (!pkgName) {
		error(`Failed to run ${cmd}: package name not given`);
		return false;
	}

	const pth = join(__dirname, "../../pkg", pkgName);

	if (!await exists(pth)) {
		error(`Failed to run ${cmd}: ${pkgName} is not a package`);
		return false;
	}

	return true;
}

module.exports = commands;
