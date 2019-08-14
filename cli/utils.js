const fs = require("fs");
const cp = require('child_process');

function ask(rl, question) {
	return new Promise(resolve => {
		rl.question(question, response => {
			resolve(response);
		});
	});
}

const statParamMap = { err: 0, stats: 1 };
function stat(...args) {
	return promisify(
		fs.stat, statParamMap, "stats",
		args
	);
}

const mkdirParamMap = { err: 0 };
function mkdir(...args) {
	return promisify(
		fs.mkdir, mkdirParamMap, null,
		args
	);
}

const rmdirParamMap = { err: 0 };
function rmdir(...args) {
	return promisify(
		fs.rmdir, rmdirParamMap, null,
		args
	);
}

const writeFileParamMap = { err: 0 };
function writeFile(...args) {
	return promisify(
		fs.writeFile, writeFileParamMap, "err",
		[...args, (err) => !err]
	);
}

const execParamMap = { err: 0, stdout: 1, stderr: 2 };
function exec(...args) {
	return promisify(
		cp.exec, execParamMap, "stdout",
		args
	);
}

function execCwd(cmd, options, callback) {
	options = Object.assign({
		cwd: process.cwd()
	}, options);

	return exec(cmd, options, callback);
}

const spawnParamMap = { process: 0 };
function spawn(...args) {
	return promisify(
		cp.spawn, spawnParamMap, "process",
		args
	);
}

// This function assumes that the last parameter
// in the supplied function is a callback,
// and similarly that the last item in the
// rest parameters is a callback that will be used
// in promisify itself instead of being passed to
// the function. If this last parameter is null,
// it will also be cut from the argument list
function promisify(func, paramNamesOrParamMap, returnKeyOrReturnIndex, args) {
	const lastArg = args[args.length - 1];
	let callback = null;

	if (typeof lastArg == "function" || lastArg === null)
		callback = args.splice(-1)[0];

	return new Promise(resolve => {
		func(...args, (...a) => {
			if (typeof callback == "function")
				resolve(callback(...a));
			else if (isObject(paramNamesOrParamMap)) {	// Parameter name/index map
				if (a[paramNamesOrParamMap.err])
					return resolve(null);

				const retIndex = typeof returnKeyOrReturnIndex == "string" ? paramNamesOrParamMap[returnKeyOrReturnIndex] : returnKeyOrReturnIndex;
				resolve(a[retIndex]);
			} else {									// Parameter name list
				const namedArgs = nameArgs(a, paramNamesOrParamMap);

				if (namedArgs.err)
					return resolve(null);
				
				resolve(namedArgs[returnKeyOrReturnIndex]);
			}
		});
	});
}

function chdir(dir) {
	return tryify(process.chdir, dir);
}

function tryify(func, ...args) {
	try {
		func(...args);
		return true;
	} catch (e) {
		console.log(e);
		return false;
	}
}

function nameArgs(args, argNames) {
	const len = Math.min(args.length, argNames),
		out = {};

	for (let i = 0; i < len; i++)
		out[argNames[i]] = args[i];

	return out;
}

function isObject(val) {
	return !!val && Object.getPrototypeOf(val) == Object.prototype;
}

function resolveVal(val, ...args) {
	if (typeof val == "function")
		return val(...args);

	return val;
}

function coerceNum(num, def) {
	return typeof num == "number" && !isNaN(num) ? num : def;
}

// Returns a short string from input as a preview
function shortPrint(val, maxArrLen = 3, useArrBrackets = true) {
	switch (typeof val) {
		case "string":
			return `"${val}"`;
		case "boolean":
		case "number":
		case "bigint":
		case "undefined":
			return String(val);
		case "symbol":
			return "Symbol()";
		case "function":
			return `function val.name(){}`;
		case "object":
			if (val == null)
				return "null";

			if (isObject(val))
				return `{ ${shortPrint(Object.keys(val), maxArrLen, false)} }`;
			else if (Array.isArray(val)) {
				const arr = val.slice(0, maxArrLen).map(v => shortPrint(v, 1));

				if (arr.length < val.length)
					arr.push("...");

				return useArrBrackets ? `[${arr.join(", ")}]` : arr.join(", ");
			} else
				return val.constructor.name;
	}

	return "";
}

function repeat(str, count = 0) {
	str = String(str);
	count = Number(count) || 0;

	if (count < 0)
		throw new RangeError("Invalid count value");

	if (!count)
		return "";
	
	let out = "";

	// Pretty much completely ripped off the left-pad implementation
	// https://github.com/left-pad/left-pad/blob/master/index.js
	// because it's pretty elegant
	while (true) {
		if (count & 1)
			out += str;

		count >>= 1;

		if (count)
			str += str;
		else
			return out;
	}
}

function logNL(str) {
	const split = str.split("\n");

	for (const s of split)
		console.log(s);
}

function coerceFilePath(path, extension = "js") {
	if (/\.\w+$/.test(path))
		return path;

	return `${path}.${extension}`;
}

function findByKey(keys, dict) {
	if (!Array.isArray(keys))
		return null;

	for (const key of keys) {
		if (dict.hasOwnProperty(key))
			return dict[key];
	}

	return null;
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

module.exports = {
	ask,
	stat,
	mkdir,
	rmdir,
	writeFile,
	exec,
	execCwd,
	spawn,
	promisify,
	chdir,
	tryify,
	nameArgs,
	isObject,
	resolveVal,
	coerceNum,
	shortPrint,
	repeat,
	logNL,
	coerceFilePath,
	findByKey,
	calcPrecedence,
	calcPrecedenceFromCLIOptions
};
