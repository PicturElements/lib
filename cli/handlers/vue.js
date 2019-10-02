const run = require("../run");
const { spawn } = require("../utils");
const Commander = require("../commander");

const STD_IO = { stdio: "inherit" };

const commands = new Commander()
	.cmd("dev-plugin", async options => {
		const [ pluginName, ...passedArgs ] = options.args,
			pkgName = `vue-cli-plugin-${pluginName}`;

		const success = await run("ql npm local-install", [
			pkgName,
			...passedArgs
		]);

		if (!success)
			return false;

		await spawn("vue", ["invoke", `@qtxr/${pluginName}`], STD_IO);
	})
	.cmd("invoke", async options => {
		const [ pluginName ] = options.args;
		await spawn("vue", ["invoke", `@qtxr/${pluginName}`], STD_IO);
	});

module.exports = commands;
