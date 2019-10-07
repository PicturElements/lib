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
	console.log("\x1b[1m\x1b[31m%s\x1b[0m", logs.map(String).join(" "));
}

function errorBlock(...logs) {
	console.log("\x1b[1m\x1b[37m\x1b[41m%s\x1b[0m", logs.map(String).join(" "));
}

module.exports = {
	info,
	success,
	warn,
	error,
	errorBlock
};
