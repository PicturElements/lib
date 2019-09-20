const path = require("path");
const {
	spawn,
	readJSONNull,
	writeJSON,
	error
} = require("../utils");
const {
	booleanQuestion,
	question
} = require("../form-utils");

const PKG_DIR = path.join(__dirname, "../../pkg"),
	STD_IO = { stdio: "inherit" };

module.exports = async function git(options, cmd) {
	const pkgPath = path.relative(PKG_DIR, "");
	if (!pkgPath)
		return console.log("Cannot use command: cwd is packages root");
	if (pkgPath.indexOf("..") == 0)
		return console.log("Cannot use command: cwd falls outside packages root");

	const root = pkgPath.split(path.sep)[0];

	console.log(`Starting in package '${root}'`);

	switch (cmd) {
		case "push":
			await push(root);
			break;
		case "unstage":
			await spawn("git", ["reset", "--soft", "HEAD~1"]);
			await spawn("git", ["status"], STD_IO);
			break;
		default:
			console.log(`Invalid command '${cmd || ""}'`);
	}
};

async function push(root) {
	const jsonPath = path.join(PKG_DIR, root, "package.json"),
		package = await readJSONNull(jsonPath);

	if (!package)
		return console.log("Couldn't find package.json");

	const pushes = package.qlib.pushes || 0;

	package.qlib.pushes = pushes + 1;
	if (!await (writeJSON(jsonPath, package, "  ")))
		return console.log("Aborting: failed to update package.json");

	process.on("beforeExit", async _ => {
		console.log("\nUndoing changes...");

		package.qlib.pushes = pushes;

		if (await (writeJSON(jsonPath, package, "  ")))
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
	await spawn("git", ["status"], STD_IO);

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
	if (commitStatus.code != 0)
		return console.log("Commit failed - dumping progress");

	const pushStatus = await spawn("git", ["push"]);
	if (pushStatus.code != 0)
		return console.log("Push failed - dumping progress");

	process.exit();
}
