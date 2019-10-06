const fs = require("fs");
const promisify = require("../promisify");
const tryify = require("../tryify");

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

function chdir(dir) {
	return tryify(process.chdir, dir);
}

module.exports = {
	mkdir,
	rmdir,
	readdir,
	chdir
};
