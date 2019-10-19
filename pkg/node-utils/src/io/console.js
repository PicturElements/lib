function info(...logs) {
	process.stdout.write("\x1b[1m\x1b[36m");
	console.log(...logs);
	process.stdout.write("\x1b[0m");
}

function success(...logs) {
	process.stdout.write("\x1b[1m\x1b[32m");
	console.log(...logs);
	process.stdout.write("\x1b[0m");
}

function warn(...logs) {
	process.stdout.write("\x1b[1m\x1b[33m");
	console.log(...logs);
	process.stdout.write("\x1b[0m");
}

function error(...logs) {
	process.stdout.write("\x1b[1m\x1b[31m");
	console.log(...logs);
	process.stdout.write("\x1b[0m");
}

function errorBlock(...logs) {
	process.stdout.write("\x1b[1m\x1b[37m\x1b[41m");
	console.log(...logs);
	process.stdout.write("\x1b[0m");
}

module.exports = {
	info,
	success,
	warn,
	error,
	errorBlock
};
