/* eslint-disable no-prototype-builtins */

const path = require("path");
const { error } = require("../pkg/node-utils");
const Commander = require("./commander");

const HOME_DIR = path.join(__dirname, "..");

const LIB_SCOPED_COMMANDS = {
	test: true,
	git: true
};

const PKG_SCOPED_COMMANDS = {
	build: true
};

const commands = new Commander({
		command: process.argv[1].split(path.sep).pop(),
		guard(cmd) {
			if (LIB_SCOPED_COMMANDS.hasOwnProperty(cmd.command) && process.cwd().indexOf(HOME_DIR) == -1) {
				error(`Refusing to run this qlib command outside the home directory (${HOME_DIR})`);
				return false;
			}

			if (PKG_SCOPED_COMMANDS.hasOwnProperty(cmd.command)) {
				if (process.cwd().indexOf(HOME_DIR) == -1) {
					error("Refusing to run this qlib command outside package directories");
					return false;
				}

				const split = process.cwd()
					.replace(HOME_DIR, "")
					.replace(new RegExp(`^\\${path.sep}`), "")
					.split(path.sep);

				if (split.length < 2) {
					error("Refusing to run this qlib command outside package directories");
					return false;
				}
			}

			return true;
		},
		intercept(cmd, options) {
			// ZSH help
			if (options.keyOptions.indexOf("h") > -1) {
				cmd.help();
				return true;
			}

			// Bash help
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
		.alias("s", "git status")
	.cmd("build")
		.alias("b", "build")
	.cmd("?", {
		handle(options) {
			options.root.logCommandsList();
		},
		listable: false
	})
		.alias("--h", "?");

async function run(command, extraArgs) {
	return await commands.run(command, null, extraArgs);
}

module.exports = run;
