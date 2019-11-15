const path = require("path");
const {
	spawn,
	readJSONNull,
	writeJSON,
	error
} = require("../../pkg/node-utils");
const {
	booleanQuestion,
	question
} = require("../form-utils");
const Commander = require("../commander");

const PKG_DIR = path.join(__dirname, "../../pkg"),
	STD_IO = { stdio: "inherit" };

const commands = new Commander({
		guard(cmd) {
			const pkgPath = path.relative(PKG_DIR, "");
			if (!pkgPath)
				return cmd.error("Cannot use command: cwd is packages root");
			if (pkgPath.indexOf("..") == 0)
				return cmd.error("Cannot use command: cwd falls outside packages root");
		}
	})
	.cmd("push", async options => {
		const root = path.relative(PKG_DIR, "").split(path.sep)[0];
		return await push(root);
	})
	.cmd("unstage", async options => {
		await spawn("git", ["reset", "--soft", "HEAD~1"]);
		await spawn("git", ["status"], STD_IO);
	})
	.cmd("status", async options => {
		return await spawn("git", ["status", "."], STD_IO);
	});

async function push(root) {
	const jsonPath = path.join(PKG_DIR, root, "package.json"),
		package = await readJSONNull(jsonPath);

	if (!package) {
		error("Couldn't find package.json");
		return false;
	}

	const pushes = package.qlib.pushes || 0;

	package.qlib.pushes = pushes + 1;
	if (!await (writeJSON(jsonPath, package, "  "))) {
		error("Aborting: failed to update package.json");
		return false;
	}

	process.on("beforeExit", async _ => {
		console.log("\nUndoing changes...");

		const resetStatus = await spawn("git", ["reset", "--soft", "HEAD~1"]);
		if (resetStatus.code == 0)
			console.log("Successfully reset commit");
		else
			error("Failed to reset commit. Run 'git reset --soft HEAD~1' to reset manually");

		package.qlib.pushes = pushes;

		if (await writeJSON(jsonPath, package, "  "))
			console.log("Successfully undid changes; exiting");
		else {
			error("WARNING: failed to update package.json. Please update it manually with the following data:");
			console.log({
				"qlib.pushes": pushes
			});
		}

		process.exit();
	});

	await spawn("git", ["add", path.join(PKG_DIR, root)], STD_IO);
	await spawn("git", ["status", "."], STD_IO);

	if (!await booleanQuestion())
		return console.log("Cancelling");

	const msgPrefix = `${package.name} ${package.version} - ${pushes}: `;
	let msg = "updated package";

	while (true) {
		msg = await question("Please add a commit message", msg, {
			validate(input) {
				return input.length > 3 ? true : "Terse commit messages are not allowed";
			}
		});
		
		msg.trim();

		if (await booleanQuestion(`${msgPrefix}${msg}\nOk?`))
			break;
	}

	const commitStatus = await spawn("git", ["commit", "-m", `${msgPrefix}${msg}`], STD_IO);
	if (commitStatus.code != 0) {
		error("Commit failed - dumping progress");
		return false;
	}

	const pushStatus = await spawn("git", ["push"]);
	if (pushStatus.code != 0) {
		error("Push failed - dumping progress");
		return false;
	}

	process.exit();
	return true;
}

module.exports = commands;
