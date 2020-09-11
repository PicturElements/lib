import { unescape } from "./str-replace";
import hasOwn from "./has-own";

const REGEX_SOURCES = {
	// /[$a-z0-9_-]+|\[(?:(["'`])((?:[^\\]|\\.)*?)\1|((?:[^\\\]]*|\\.)+?))\]/gi
	path: "[$:a-z0-9_-]+|\\[(?:([\"'`])((?:[^\\\\]|\\\\.)*?)\\1|((?:[^\\\\\\]]*|\\\\.)+?))\\]",
	// /([$a-z0-9_-]+(?:\.[$a-z0-9_-]+?|\[(?:(["'`])(?:[^\\]|\\.)*?\2|(?:[^\\\]]|\\.)+?)\])*)/gi
	match: "([$:a-z0-9_-]+(?:\\.[$a-z0-9_-]+|\\[(?:([\"'`])(?:[^\\\\]|\\\\.)*?\\2|(?:[^\\\\\\]]|\\\\.)+?)\\])*)",
	// /[$a-z0-9_-]/gi
	normalPropertyChars: "[$:a-z0-9_-]",
	// /[^$a-z0-9_-]/
	abnormalPropertyChars: "[^$:a-z0-9_-]"
};

const REGEXES = {
	path: new RegExp(REGEX_SOURCES.path, "gi"),
	match: new RegExp(REGEX_SOURCES.match, "gi"),
	matchFull: new RegExp(`^${REGEX_SOURCES.match}$`, "i"),
	normalPropertyChars: new RegExp(REGEX_SOURCES.normalPropertyChars, "gi"),
	abnormalPropertyChars: new RegExp(REGEX_SOURCES.abnormalPropertyChars, "i")
};

// REGEXES.path capturing groups:
// 1: String quote character (within bracket notation)
// 2: String within quotes (within bracket notation) - will be unescaped by splitPath
// 3: String within bracket notation without quotes - will be unescaped by splitPath
const PATH_REGEX = new RegExp(REGEX_SOURCES.path, "gi"),
	SPLIT_CACHE = {};

export default function splitPath(path) {
	if (Array.isArray(path))
		return path;

	if (typeof path == "symbol")
		return [path];

	if (typeof path != "string" && typeof path != "number")
		return [];

	if (hasOwn(SPLIT_CACHE, path))
		return SPLIT_CACHE[path];

	const out = [];
	path = String(path);

	while (true) {
		const ex = PATH_REGEX.exec(path);

		if (!ex)
			break;

		const bracketCapture = ex[2] || ex[3];

		if (bracketCapture)
			out.push(unescape(bracketCapture));
		else
			out.push(ex[0]);
	}

	SPLIT_CACHE[path] = out;
	return out;
}

splitPath.regexSources = REGEX_SOURCES;
splitPath.regexes = REGEXES;
