const path = require("path");
const {
	stat,
	join,
	mkdir,
	exec,
	exists,
	info,
	warn,
	error,
	success,
	collectFileTree
} = require("../../../pkg/node-utils");
const { isObject } = require("../../../utils");
const { booleanQuestion } = require("../../form-utils");

const TAB_WIDTH = 2;

async function moveCursor(dX, dY = 0) {
	return new Promise(resolve => {
		process.stdout.moveCursor(dX, dY, _ => {
			resolve(true);
		});
	});
}

async function clearLine(removal) {
	return new Promise(resolve => {
		process.stdout.clearLine(-removal, _ => {
			process.stdout.moveCursor(-removal, 0, _ => {
				resolve(true);
			});
		});
	});
}

function getTime(time) {
	if (time < 1000)
		return `${time}ms`;

	return `${Number((time / 1000).toPrecision(3))}s`;
}

function getSize(bytes) {
	const postfixes = ["b", "kb", "mb", "gb"],
		order = Math.min(Math.floor(Math.log10(bytes) / 3), 3);

	return `${Number((bytes / (1e3 ** order)).toPrecision(3))}${postfixes[order]}`;
}

function getCompression(iBytes, oBytes) {
	return `${Number(((1 - oBytes/ iBytes) * 100).toPrecision(3))}%`;
}

module.exports = async function convertFiles(options, args = {}) {
	const {
		name = "file",
		extension = "",
		extensions = /\.\w+$/,
		extensionsStr = "",
		optionStyle = `--$key $value`,
		defaultOptions = {},
		command = "echo $input $output $options",
		errorCode = -1
	} = args;

	if (!options.args[0])
		return error("No IO paths specified");

	const cwd = process.cwd(),
		[iPath, oPath = iPath] = options.args
			.map(p => join(cwd, p)),
		kvOptions = {
			...defaultOptions,
			...options.kvOptions
		},
		passedOptions = Object.entries(kvOptions)
			.map(([k, v]) => optionStyle.replace("$key", k).replace("$value", v))
			.join(" ");

	const cont = await booleanQuestion(`input:\t${iPath}\noutput:\t${oPath}\nok? (y/n)`);
	if (!cont)
		return;

	const tree = await collectFileTree(
		iPath,
		file => extensions.test(file),
		true
	);

	if (!tree)
		return console.log(`Failed to exec ${name}: please run this command on a directory containing ${extensionsStr} files`);

	const oPathExists = await exists(oPath);

	await mkdir(oPath, {
		recursive: true
	});

	const metrics = {
		files: 0,
		directories: 0,
		writes: 0,
		inputSize: 0,
		outputSize: 0
	};

	const collect = (node, iPth, oPth) => {
		const directory = {
			type: "directory",
			name: oPth.split(path.sep).pop(),
			input: iPth,
			output: oPth,
			children: []
		};

		for (const k in node) {
			const item = node[k],
				workingIPath = join(iPth, k),
				workingOPath = join(oPth, k);

			if (isObject(item)) {
				metrics.directories++;
				directory.children.push(
					collect(item, workingIPath, workingOPath)
				);
			} else if (extensions.test(workingOPath)) {
				const oName = k.replace(
					extensions,
					extension ? `.${extension}` : ""
				);

				metrics.files++;
				directory.children.push({
					type: "file",
					name: k,
					outputName: oName,
					input: join(iPth, k),
					output: join(oPth, oName)
				});
			}
		}

		return directory;
	};

	// Status mask states:
	// -1: closed
	//  0: open, unitialized
	//  1: open, created
	//  2: open, updated
	const convert = async (directory, statusMask = [], initStatus = 0, clearPrevious = false) => {
		if (clearPrevious)
			statusMask[statusMask.length - 1] = -1;

		statusMask.push(initStatus);

		for (let i = 0, l = directory.children.length; i < l; i++) {
			const child = directory.children[i];
			let line = "";

			for (let j = 0, l2 = statusMask.length; j < l2; j++) {
				const status = statusMask[j];

				if (status > 0) {
					line += status == 1 ?
						"\x1b[1m\x1b[32m" :
						"\x1b[1m\x1b[36m";
				}

				if (j == l2 - 1)
					line += `${i == l - 1 ? "└" : "├"}${"─".repeat(TAB_WIDTH - 1)} `;
				else if (status == -1)
					line += " ".repeat(TAB_WIDTH + 1);
				else
					line += `│${" ".repeat(TAB_WIDTH)}`;

				if (status > 0)
					line += "\x1b[0m";
			}

			process.stdout.write(line);

			if (child.type == "directory") {
				process.stdout.write(child.name);
				const status = await mkdir(child.output);

				if (status == null) {
					await moveCursor(-child.name.length);

					if (status === null) {
						info(child.name);
						statusMask[statusMask.length - 1] = 2;
					} else {
						success(child.name);
						statusMask[statusMask.length - 1] = 1;
					}

					await convert(
						child,
						statusMask,
						statusMask[statusMask.length - 1],
						i == l - 1
					);
				} else
					console.log();

				continue;
			}

			const commandArgs = {
				input: child.input,
				output: child.output,
				options: passedOptions,
				optionsRaw: kvOptions
			};

			const cmd = typeof command == "function" ?
					command(commandArgs) :
					command.replace(/\$(\w+)/g, (match, capture) => commandArgs[capture] || ""),
				baseLine = line + child.outputName,
				countLine = ` \x1b[1m\x1b[33m(${metrics.writes + 1}/${metrics.files})\x1b[0m`;

			process.stdout.write(child.outputName + countLine);

			const start = Date.now();
			const exitCode = await exec(cmd);

			await clearLine(baseLine.length + countLine.length);

			const duration = getTime(Date.now() - start),
				isError = typeof errorCode == "function" ?
					errorCode(exitCode) :
					exitCode == errorCode;

			process.stdout.write(baseLine);

			if (isError) {
				error(` ✗ ${duration} exit: ${exitCode}`);
				console.log(cmd);
			} else {
				const [iStat, oStat] = await Promise.all([
					stat(child.input),
					stat(child.output)
				]);

				metrics.inputSize += iStat.size;
				metrics.outputSize += oStat.size;

				const iSize = getSize(iStat.size),
					oSize = getSize(oStat.size),
					compression = getCompression(iStat.size, oStat.size);

				process.stdout.write(` \x1b[1m\x1b[32m✓ ${duration}\x1b[0m \x1b[1m\x1b[36m${iSize} ⟶ ${oSize} (${compression})\x1b[0m\n`);
				metrics.writes++;
			}
		}

		statusMask.pop();
	};

	const dir = collect(tree, iPath, oPath);

	info(`\n${metrics.files} ${metrics.files == 1 ? "file" : "files"}`);
	info(`${metrics.directories} ${metrics.directories == 1 ? "directory" : "directories"}`);
	warn(`${passedOptions}\n`);

	if (oPathExists)
		info(oPath);
	else
		success(oPath);

	const startTime = Date.now();
	await convert(dir, [], oPathExists ? 2 : 1);
	process.stdout.write(`\n${metrics.writes}/${metrics.files} ${metrics.files == 1 ? "file" : "files"} \x1b[1m\x1b[32m✓ ${getTime(Date.now() - startTime)}\x1b[0m \x1b[1m\x1b[36m${getSize(metrics.inputSize)} ⟶ ${getSize(metrics.outputSize)} (${getCompression(metrics.inputSize, metrics.outputSize)})\x1b[0m\n`);
};
