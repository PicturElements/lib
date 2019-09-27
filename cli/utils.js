// Utilities pertinent to CLI, the file system, and OS in general

const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const {
	promisify,
	tryify,
	findByKey
} = require("../utils");

function ask(rl, ...args) {
	return promisify(
		rl.question.bind(rl), null, null
	)(args);
}

const statParamMap = { err: 0, stats: 1 };
function stat(...args) {
	return promisify(
		fs.stat, statParamMap, "stats"
	)(args);
}

const mkdirParamMap = { err: 0 };
function mkdir(...args) {
	return promisify(
		fs.mkdir, mkdirParamMap, null
	)(args);
}

const rmdirParamMap = { err: 0 };
function rmdir(...args) {
	return promisify(
		fs.rmdir, rmdirParamMap, null
	)(args);
}

const readdirParamMap = { err: 0, files: 1 };
function readdir(...args) {
	return promisify(
		fs.readdir, readdirParamMap, "files"
	)(args);
}

function writeFile(...args) {
	return promisify(
		fs.writeFile, null, null,
		(resolve, err) => resolve(!err)
	)(args);
}

const execParamMap = { err: 0, stdout: 1, stderr: 2 };
function exec(...args) {
	return promisify(
		cp.exec, execParamMap, "stdout"
	)(args);
}

const spawnParamMap = { process: 0 };
function spawn(...args) {
	return promisify(
		cp.spawn, spawnParamMap, "process",
		{
			mode: "manual",
			callback(resolve, process) {
				process.on("exit", (code, signal) => {
					resolve({
						code,
						signal
					});
				});
			}
		}
	)(args);
}

function exists(url) {
	return promisify(
		fs.access, null, null,
		(resolve, err) => resolve(!err)
	)([url, fs.constants.F_OK]);
}

// Intended to open a descriptor for R/W and prevent race conditions, as
// specified here: https://nodejs.org/api/fs.html#fs_fs_access_path_mode_callback
async function findFileDescriptor(...paths) {
	for (const url of paths) {
		const descriptor = await getFileDescriptor(url);

		if (descriptor > -1)
			return descriptor;
	}

	return -1;
}

function getFileDescriptor(url, flags = "r", mode = 0o666) {
	return new Promise(resolve => {
		fs.open(url, flags, mode, (err, descriptor) => resolve(err ? -1 : descriptor));
	});
}

function closeFile(descriptor) {
	return new Promise(resolve => {
		fs.close(descriptor, err => resolve(!err));
	});
}

async function readFile(...paths) {
	const descriptor = await findFileDescriptor(...paths);

	if (descriptor == -1)
		return null;

	const buffer = await readFileHelper(descriptor);
	await closeFile(descriptor);
	return buffer;
}

async function readFileUTF(...paths) {
	const descriptor = await findFileDescriptor(...paths);
	
	if (descriptor == -1)
		return null;
	
	const data = await readFileHelper(descriptor, "utf8");
	await closeFile(descriptor);
	return data;
}

// Recommended: supply a file descriptor as the accessor
function readFileHelper(accessor, encoding = null) {
	return new Promise(resolve => {
		if (typeof accessor == "number" && accessor < 0)
			return resolve(null);

		fs.readFile(accessor, encoding, (err, data) => resolve(err ? null : data));
	});
}

async function readJSON(...paths) {
	return JSON.parse(await readFileUTF(...paths)) || {};
}

async function readJSONNull(...paths) {
	return JSON.parse(await readFileUTF(...paths)) || null;
}

async function writeJSON(pth, data, indentStr = "\t") {
	return writeFile(pth, JSON.stringify(data, null, indentStr));
}

async function collectFileTree(root, filter, terse) {
	async function collect(dirPath) {
		const dir = {},
			files = await readdir(dirPath);
		let matched = false;

		if (!files)
			return null;

		for (const file of files) {
			const workingPath = path.join(dirPath, file),
				s = await stat(workingPath);
			let item = null;

			if (!s)
				return;

			if (s.isDirectory())
				item = await collect(workingPath);
			else if (typeof filter != "function")
				item = workingPath;
			else if (filter(file, workingPath))
				item = workingPath;

			if (item) {
				dir[file] = item;
				matched = true;
			}
		}

		return !terse || matched ? dir : null;
	}

	return await collect(root);
}

function chdir(dir) {
	return tryify(process.chdir, dir);
}

function logNL(str) {
	const split = str.split("\n");

	for (const s of split)
		console.log(s);
}

function coerceFilePath(pth, extension = "js") {
	if (/\.\w+$/.test(pth))
		return pth;

	return `${pth}.${extension}`;
}

function calcPrecedence(inp, nameMap, def) {
	switch (typeof inp) {
		case "string": {
			if (nameMap.hasOwnProperty(inp))
				return nameMap[inp];

			const precedence = Number(inp);
			return isNaN(precedence) ? def : precedence;
		}

		case "number":
			return isNaN(inp) ? def : inp;
	}

	return def;
}

function calcPrecedenceFromCLIOptions(options, nameMap, def) {
	if (options.kvOptions.hasOwnProperty("precedence"))
		return calcPrecedence(options.kvOptions.precedence, nameMap, def);

	const prec = findByKey(options.keyOptions, nameMap);
	if (prec !== null)
		return prec;

	return def;
}

function info(...logs) {
	console.log("\x1b[1m\x1b[36m%s\x1b[0m", logs.map(String).join(" "));
}

function success(...logs) {
	console.log("\x1b[1m\x1b[32m%s\x1b[0m", logs.map(String).join(" "));
}

function warn(...logs) {
	console.log("\x1b[1m\x1b[33m%s\x1b[0m", logs.map(String).join(" "));
}

function error(...logs) {
	console.log("\x1b[1m\x1b[37m\x1b[41m%s\x1b[0m", logs.map(String).join(" "));
}

function join(...paths) {
	return path.join(...paths);
}

function joinDir(...paths) {
	return path.join(__dirname, "..", ...paths);
}

async function findUrl(...urls) {
	for (const url of urls) {
		if (await exists(url))
			return url;
	}

	return null;
}

module.exports = {
	ask,
	stat,
	mkdir,
	rmdir,
	readdir,
	writeFile,
	exec,
	spawn,
	exists,
	readFile,
	readJSON,
	readJSONNull,
	writeJSON,
	collectFileTree,
	chdir,
	logNL,
	coerceFilePath,
	calcPrecedence,
	calcPrecedenceFromCLIOptions,
	info,
	success,
	warn,
	error,
	join,
	joinDir,
	findUrl
};
