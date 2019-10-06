const {
	readFileUTF,
	writeFile
} = require("./file");
const { merge } = require("../utils");

async function readJSON(...paths) {
	return JSON.parse(await readFileUTF(...paths)) || {};
}

async function readJSONNull(...paths) {
	return JSON.parse(await readFileUTF(...paths)) || null;
}

async function writeJSON(pth, data, indentStr = "\t") {
	return writeFile(pth, JSON.stringify(data, null, indentStr));
}

async function updateJSON(pth, data, indentStr = "\t") {
	const json = await readJSON(pth);

	data = typeof data == "function" ? data(json) : data;

	return writeFile(pth, JSON.stringify(
		merge(json, data),
		null,
		indentStr
	));
}

module.exports = {
	readJSON,
	readJSONNull,
	writeJSON,
	updateJSON
};
