import {
	escape,
	unescape
} from "./str";
import hasOwn from "./has-own";

const REGEX_SOURCES = {
	// /([$:a-z0-9_-]+)|\[(?:\s*(["'`])((?:[^\\]|\\.)*?)\2\s*|((?:[^\\\]]*|\\.)+?))\]/gi
	path: "([$:a-z0-9_-]+)|\\[(?:\\s*([\"'`])((?:[^\\\\]|\\\\.)*?)\\2\\s*|((?:[^\\\\\\]]*|\\\\.)+?))\\]",
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

function splitPath(path) {
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

		const bracketCapture = ex[3] || ex[4];

		if (bracketCapture)
			out.push(unescape(bracketCapture));
		else if (ex[1])
			out.push(ex[1]);
	}

	SPLIT_CACHE[path] = out;
	return out;
}

splitPath.regexSources = REGEX_SOURCES;
splitPath.regexes = REGEXES;

function mkPath(...components) {
	let accessor = "";

	for (let i = 0, l = components.length; i < l; i++) {
		let component = components[i],
			combined = false;

		if (component === "" || typeof component == "symbol")
			continue;

		if (Array.isArray(component)) {
			component = mkPath(...component);
			combined = true;
		} else
			component = String(component);

		if (!isNaN(component) && component != "Infinity" && component != "-Infinity")
			accessor += `[${cleanPath(component)}]`;
		else if (!combined && REGEXES.abnormalPropertyChars.test(component))
			accessor += `[${cleanPathComponent(component)}]`;
		else
			accessor += accessor && component[0] != "[" ? `.${component}` : component;
	}

	return accessor;
}

function isPath(candidate) {
	if (typeof candidate != "string")
		return false;

	return REGEXES.matchFull.test(candidate);
}

function cleanPath(str) {
	return escape(str).replace(/(\])/g, "\\$&");
}

function cleanPathComponent(str, defaultQuote = "'") {
	if (typeof str != "string")
		return "";

	const quotes = {
		"'": 0,
		"\"": 0,
		"`": 0
	};
	let maxQuote = null,
		maxCount = 0,
		enforceQuote = false;

	for (let i = 0, l = str.length; i < l; i++) {
		const char = str[i];

		if (char == "]")
			enforceQuote = true;

		if (!hasOwn(quotes, char))
			continue;

		quotes[char]++;

		if (quotes[char] > maxCount) {
			maxQuote = char;
			maxCount = quotes[char];
		}
	}

	if (!maxQuote && !enforceQuote)
		return escape(str, /['"`\\]/g);

	const altQuote = defaultQuote == "'" ?
			"\"" :
			"'",
		quote = maxQuote && maxQuote == defaultQuote ?
			altQuote :
			defaultQuote;

	return quote + escape(str, /['"`\\]/g, maxQuote) + quote;
}

export {
	splitPath,
	mkPath,
	isPath,
	cleanPath,
	cleanPathComponent
};
