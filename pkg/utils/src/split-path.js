import { unescape } from "./str-replace";
import hasOwn from "./has-own";

const regexSources = {
	// /[$a-z0-9_-]+|\[(?:(["'`])((?:[^\\]|\\.)*?)\1|((?:[^\\\]]*|\\.)+?))\]"/gi
	path: "[$a-z0-9_-]+|\\[(?:([\"'`])((?:[^\\\\]|\\\\.)*?)\\1|((?:[^\\\\\\]]*|\\\\.)+?))\\]",
	// /([$a-z0-9_-]+(?:\.[$a-z0-9_-]+?|\[(?:(["'`])(?:[^\\]|\\.)*?\2|(?:[^\\\]]*|\\.)+?)\])*)/gi
	match: "([$a-z0-9_-]+(?:\\.[$a-z0-9_-]+|\\[(?:([\"'`])(?:[^\\\\]|\\\\.)*?\\2|(?:[^\\\\\\]]*|\\\\.)+?)\\])*)",
	// /[$a-z0-9_-]/gi
	normalPropertyChars: "[$a-z0-9_-]",
	// /[^$a-z0-9_-]/
	abnormalPropertyChars: "[^$a-z0-9_-]"
};

const regexes = {
	path: new RegExp(regexSources.path, "gi"),
	match: new RegExp(regexSources.match, "gi"),
	normalPropertyChars: new RegExp(regexSources.normalPropertyChars, "gi"),
	abnormalPropertyChars: new RegExp(regexSources.abnormalPropertyChars, "i")
};

// /\[((?:[^\\[\]]*(?:\\.)?)*)\]|\.?((?:[^\\[\].]*(?:\\.)?)*)/g
// /\[(["'`]?)((?:[^\\[\]]|\\.)*?)\1\]|\.?((?:[^\\[\].]*(?:\\.)?)*)/g
// /\[((["'`])(?:[^\\]|\\.)+?\2|(?:[^\\[\]]|\\.)+?)\]|(?:^|\.)((?:[^\\[.]|\\.)+)/g
// /(?:^|\.)((?:[^\\[.]|\\.)+)|\[(?:(["'`])((?:[^\\]|\\.)+?)\2|((?:[^\\[\]]|\\.)+?))\]/g

// regexes.path capturing groups:
// 1: String quote character (within bracket notation)
// 2: String within quotes (within bracket notation) - will be unescaped by splitPath
// 3: String within bracket notation without quotes - will be unescaped by splitPath
const pathRegex = new RegExp(regexSources.path, "gi"),
	splitCache = {};

export default function splitPath(path) {
	if (Array.isArray(path))
		return path;

	if (typeof path == "symbol")
		return [path];

	if (typeof path != "string" && typeof path != "number")
		return [];

	if (hasOwn(splitCache, path))
		return splitCache[path];

	const out = [];
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
