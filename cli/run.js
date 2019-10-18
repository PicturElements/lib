const path = require("path");
const Commander = require("./commander");
const { error } = require("../pkg/node-utils");

const HOME_DIR = path.join(__dirname, "..");

const libScopedCommands = {
	test: true,
	git: true
};

const commands = new Commander({
		command: process.argv[1].split(path.sep).pop(),
		guard(cmd) {
			if (libScopedCommands.hasOwnProperty(cmd.command) && process.cwd().indexOf(HOME_DIR) == -1) {
				error(`Refusing to run this qlib command outside the home directory (${HOME_DIR})`);
				return false;
			}

			return true;
		},
		intercept(cmd, options) {
			switch (options.args[0]) {
				case "?":
					cmd.help();
					return true;
			}

			return false;
		}
	})
	.cmd("init")
	.cmd("i18n")
	.cmd("webp")
	.cmd("npm")
		.alias("i", "npm install")
		.alias("li", "npm local-install")
		.alias("lu", "npm local-uninstall")
	.cmd("vue")
		.alias("vdp", "vue dev-plugin")
		.alias("vi", "vue invoke")
	.cmd("jest")
	.cmd("git")
		.alias("gp", "git push")
		.alias("p", "git push")
	.cmd("?", {
		handle(options) {
			options.root.logCommandsList();
		},
		listable: false
	});

async function run(command, extraArgs) {
	return await commands.run(command, null, extraArgs);
}

module.exports = run;
