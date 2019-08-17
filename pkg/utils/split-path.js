import { unescape } from "./str";

const regexSources = {
	// /[^\n\s\\[.]+|\[(?:(["'`])((?:[^\\]|\\.)*?)\1|((?:[^\\\]]*|\\.)+?))\]/g
	path: "[^\\n\\s\\\\[.]+|\\[(?:([\"'`])((?:[^\\\\]|\\\\.)*?)\\1|((?:[^\\\\\\]]*|\\\\.)+?))\\]",
	// /([^\n\s\\[.]+(?:\.[^\n\s\\[.]+|\[(?:(["'`])(?:[^\\]|\\.)*?\2|(?:[^\\\]]*|\\.)+?)\])*)/g
	match: "([^\\n\\s\\\\[.]+(?:\\.[^\\n\\s\\\\[.]+|\\[(?:([\"'`])(?:[^\\\\]|\\\\.)*?\\2|(?:[^\\\\\\]]*|\\\\.)+?)\\])*)"
};

const regexes = {
	path: new RegExp(regexSources.path, "g"),
	match: new RegExp(regexSources.math, "g")
};

// /\[((?:[^\\[\]]*(?:\\.)?)*)\]|\.?((?:[^\\[\].]*(?:\\.)?)*)/g
// /\[(["'`]?)((?:[^\\[\]]|\\.)*?)\1\]|\.?((?:[^\\[\].]*(?:\\.)?)*)/g
// /\[((["'`])(?:[^\\]|\\.)+?\2|(?:[^\\[\]]|\\.)+?)\]|(?:^|\.)((?:[^\\[.]|\\.)+)/g
// /(?:^|\.)((?:[^\\[.]|\\.)+)|\[(?:(["'`])((?:[^\\]|\\.)+?)\2|((?:[^\\[\]]|\\.)+?))\]/g

// regexes.path capturing groups:
// 1: String quote character (within bracket notation)
// 2: String within quotes (within bracket notation) - will be unescaped by splitPath
// 3: String within bracket notation without quotes - will be unescaped by splitPath
const pathRegex = new RegExp(regexSources.path, "g"),
	splitCache = {};

export default function splitPath(path) {
	if (splitCache.hasOwnProperty(path))
		return splitCache[path];

	if (Array.isArray(path))
		return path;

	if (typeof path != "string" && typeof path != "number")
		return "";

	let out = [];
	path = String(path);

	while (true) {
		const ex = pathRegex.exec(path);

		if (!ex)
			break;

		const bracketCapture = ex[2] || ex[3];

		if (bracketCapture)
			out.push(unescape(bracketCapture));
		else
			out.push(ex[0]);
	}

	splitCache[path] = out;
	return out;
}

splitPath.regexSources = regexSources;
splitPath.regexes = regexes;
