const fs = require("fs");
const promisify = require("../promisify");

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

function writeFile(...args) {
	return promisify(
		fs.writeFile, null, null,
		(resolve, err) => resolve(!err)
	)(args);
}

// TODO: promisify
function closeFile(descriptor) {
	return new Promise(resolve => {
		fs.close(descriptor, err => resolve(!err));
	});
}

const unlinkParamMap = { err: 0 };
function unlink(...args) {
	return promisify(
		fs.unlink, unlinkParamMap, null
	)(args);
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

module.exports = {
	readFile,
	readFileUTF,
	writeFile,
	closeFile,
	unlink
};
