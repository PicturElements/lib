const fs = require("fs");
const cp = require("child_process");
const promisify = require("../promisify");

const statParamMap = { err: 0, stats: 1 };
function stat(...args) {
	return promisify(
		fs.stat, statParamMap, "stats"
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

module.exports = {
	stat,
	exec,
	spawn,
	exists
};
