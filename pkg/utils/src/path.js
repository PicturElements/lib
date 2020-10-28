import {
	optionize,
	composeOptionsTemplates,
	createOptionsObject
} from "./internal/options";
import { LFUCache } from "./internal/cache";
import {
	escape,
	unescape
} from "./string";
import hasOwn from "./has-own";

const REGEX_SOURCES = {
	// /([$:a-z0-9_-]+)|\[(?:\s*(["'`])((?:[^\\]|\\.)*?)\2\s*|((?:[^\\\]]*|\\.)+?))\]/gi
	path: "([$:a-z0-9_-]+)|\\[(?:\\s*([\"'`])((?:[^\\\\]|\\\\.)*?)\\2\\s*|((?:[^\\\\\\]]*|\\\\.)+?))\\]",
	// /([$:*a-z0-9_-]+)|\[(?:\s*(["'`])((?:[^\\]|\\.)*?)\2\s*|((?:[^\\\]]*|\\.)+?))\]/gi
	pathGlob: "([$:*a-z0-9_-]+)|\\[(?:\\s*([\"'`])((?:[^\\\\]|\\\\.)*?)\\2\\s*|((?:[^\\\\\\]]*|\\\\.)+?))\\]",
	// /((?:[^.[\\]|\\.)+)|\[(?:\s*(["'`])((?:[^\\]|\\.)*?)\2\s*|((?:[^\\\]]*|\\.)+?))\]/gi
	pathPermissive: "((?:[^.[\\\\]|\\\\.)+)|\\[(?:\\s*([\"'`])((?:[^\\\\]|\\\\.)*?)\\2\\s*|((?:[^\\\\\\]]*|\\\\.)+?))\\]",
	// /([$:a-z0-9_-]+(?:\.[$a-z0-9_-]+?|\[(?:(["'`])(?:[^\\]|\\.)*?\2|(?:[^\\\]]|\\.)+?)\])*)/gi
	match: "([$:a-z0-9_-]+(?:\\.[$a-z0-9_-]+|\\[(?:([\"'`])(?:[^\\\\]|\\\\.)*?\\2|(?:[^\\\\\\]]|\\\\.)+?)\\])*)",
	// /[$:a-z0-9_-]/gi
	normalPropertyChars: "[$:a-z0-9_-]",
	// /[$:*?a-z0-9_-]/gi
	normalPropertyCharsGlob: "[$:*?a-z0-9_-]",
	// /[^.[]/gi
	normalPropertyCharsPermissive: "[^.[]",
	// /[^$:a-z0-9_-]/
	abnormalPropertyChars: "[^$:a-z0-9_-]",
	// /[^$:*?a-z0-9_-]/
	abnormalPropertyCharsGlob: "[^$:*?a-z0-9_-]",
	// /[.[]/
	abnormalPropertyCharsPermissive: "[.[]"
};

const REGEXES = {
	path: new RegExp(REGEX_SOURCES.path, "gi"),
	pathGlob: new RegExp(REGEX_SOURCES.pathGlop, "gi"),
	pathPermissive: new RegExp(REGEX_SOURCES.path, "gi"),
	match: new RegExp(REGEX_SOURCES.match, "gi"),
	matchFull: new RegExp(`^${REGEX_SOURCES.match}$`, "i"),
	normalPropertyChars: new RegExp(REGEX_SOURCES.normalPropertyChars, "i"),
	normalPropertyCharsGlob: new RegExp(REGEX_SOURCES.normalPropertyCharsGlob, "i"),
	normalPropertyCharsPermissive: new RegExp(REGEX_SOURCES.normalPropertyCharsPermissive, "i"),
	abnormalPropertyChars: new RegExp(REGEX_SOURCES.abnormalPropertyChars, "i"),
	abnormalPropertyCharsGlob: new RegExp(REGEX_SOURCES.abnormalPropertyCharsGlob, "i"),
	abnormalPropertyCharsPermissive: new RegExp(REGEX_SOURCES.abnormalPropertyCharsPermissive, "i")
};

// REGEXES.path capturing groups:
// 1: Normal path component
// 2: String quote character (within bracket notation)
// 3: String within quotes (within bracket notation) - will be unescaped by splitPath
// 4: String within bracket notation without quotes - will be unescaped by splitPath
const PATH_REGEX = new RegExp(REGEX_SOURCES.path, "gi"),
	PATH_GLOB_REGEX = new RegExp(REGEX_SOURCES.pathGlob, "gi"),
	PATH_PERMISSIVE_REGEX = new RegExp(REGEX_SOURCES.pathPermissive, "gi"),
	SPLIT_CACHE = new LFUCache();

const SPLIT_PATH_OPTIONS_TEMPLATES = composeOptionsTemplates({
	recursive: true,
	clone: true,
	glob: true,
	permissive: true,
	url: {
		separator: "/"
	}
});

function splitPath(path, options = null) {
	options = createOptionsObject(options, SPLIT_PATH_OPTIONS_TEMPLATES);

	if (Array.isArray(path)) {
		if (!options.recursive) {
			return options.clone ?
				path.slice() :
				path;
		}

		const out = [];

		for (let i = 0, l = path.length; i < l; i++) {
			const components = splitPath(path[i], options);

			for (let j = 0, l2 = components.length; j < l2; j++)
				out.push(components[j]);
		}

		return out;
	}

	if (typeof path == "symbol")
		return [path];

	if (typeof path != "string" && typeof path != "number")
		return [];

	const cacheKey = options.separator ?
		`${path}@${getSplitMode(options)}:${options.separator || ""}` :
		`${path}@${getSplitMode(options)}`;

	if (SPLIT_CACHE.has(cacheKey)) {
		return options.clone ?
			SPLIT_CACHE.get(cacheKey).slice() :
			SPLIT_CACHE.get(cacheKey);
	}

	path = String(path);

	let out = [];

	if (options.separator)
		out = splitPathSeparator(path, options);
	else
		out = splitPathAccessor(path, options);

	SPLIT_CACHE.set(cacheKey, out);

	return options.clone ?
		out.slice() :
		out;
}

splitPath.regexSources = REGEX_SOURCES;
splitPath.regexes = REGEXES;

function splitPathSeparator(path, options) {
	const out = [],
		separator = options.separator;
	let buffer = "",
		sepBuffer = "",
		sepPtr = 0;

	for (let i = 0, l = path.length; i < l; i++) {
		const char = path[i],
			inSeparator = char == separator[sepPtr] && (
				sepPtr ||
				char != "\\"||
				path[i + 1] == separator[1] ||
				path[i + 1] != separator[0]
			);

		if (inSeparator) {
			sepBuffer += char;
			sepPtr++;
		} else if (char == "\\") {
			buffer += (i == l - 1) ?
				"\\" :
				path[i + 1];
			i++;
		} else {
			if (sepBuffer) {
				buffer += sepBuffer;
				sepBuffer = "";
				sepPtr = 0;
			}

			buffer += char;
		}

		if (sepBuffer == separator) {
			if (buffer)
				out.push(buffer);
			buffer = "";
			sepBuffer = "";
			sepPtr = 0;
		}
	}

	if (buffer)
		out.push(buffer);

	return out;
}

function splitPathAccessor(path, options) {
	const out = [];
	let regex = PATH_REGEX;

	if (options.permissive)
		regex = PATH_PERMISSIVE_REGEX;
	else if (options.glob)
		regex = PATH_GLOB_REGEX;

	while (true) {
		const ex = regex.exec(path);

		if (!ex)
			break;

		const bracketCapture = ex[3] || ex[4];

		if (bracketCapture)
			out.push(unescape(bracketCapture));
		else if (ex[1])
			out.push(ex[1]);
	}

	return out;
}

function getSplitMode(options) {
	if (options.separator)
		return "separator";

	if (options.permissive)
		return "permissive-accessor";

	else if (options.glob)
		return "glob-accessor";

	return "accessor";
}

function joinPath(...components) {
	return joinPathHelper(
		components,
		joinPath.extractOptions() || {}
	);
}

function joinPathHelper(components, options) {
	let path = "",
		abnormalRegex = REGEXES.abnormalPropertyChars;

	if (options.permissive)
		abnormalRegex = REGEXES.abnormalPropertyCharsPermissive;
	else if (options.glob)
		abnormalRegex = REGEXES.abnormalPropertyCharsGlob;

	for (let i = 0, l = components.length; i < l; i++) {
		let component = components[i],
			combined = false;

		if (component === "" || typeof component == "symbol")
			continue;

		if (Array.isArray(component)) {
			component = joinPathHelper(component, options);
			combined = true;
		} else
			component = String(component);

		if (!component)
			continue;

		if (options.separator) {
			if (path)
				path += options.separator;

			path += combined ?
				component :
				cleanSeparatedPathComponent(component, options);
		} else if (!isNaN(component) && component != "Infinity" && component != "-Infinity")
			path += `[${cleanPathComponent(component)}]`;
		else if (!combined && abnormalRegex.test(component))
			path += `[${cleanPathComponent(component)}]`;
		else {
			path += path && component[0] != "[" ?
				`.${component}` :
				component;
		}
	}

	return path;
}

optionize(joinPath, {
	glob: true,
	permissive: true,
	url: {
		separator: "/"
	}
});

function normalizePath(...components) {
	const options = normalizePath.extractOptionsNullable(),
		splitOptions = options ?
			[{ recursive: true }, options, options.from || options.split] :
			{ recursive: true },
		joinOptions = options && (options.to || options.join) ?
			[options, options.to || options.join] :
			options;

	const split = splitPath(components, splitOptions);
	return joinPath.with(joinOptions)(split);
}

optionize(normalizePath, SPLIT_PATH_OPTIONS_TEMPLATES);

function isPath(candidate) {
	if (typeof candidate != "string")
		return false;

	return REGEXES.matchFull.test(candidate);
}

function cleanPath(path) {
	return escape(path).replace(/(\])/g, "\\$&");
}

function cleanSeparatedPathComponent(component, options) {
	const separator = options.separator;
	let out = "",
		sepBuffer = "",
		sepPtr = 0;

	for (let i = 0, l = component.length; i < l; i++) {
		const char = component[i];

		if (char == "\\")
			out += "\\\\";
		else if (char == separator[sepPtr])
			sepBuffer += char;
		else {
			if (sepBuffer) {
				out += sepBuffer;
				sepBuffer = "";
				sepPtr = 0;
			}

			out += char;
		}

		if (sepBuffer == separator) {
			out += `\\${sepBuffer}`;
			sepBuffer = "";
			sepPtr = 0;
		}
	}

	if (sepBuffer == separator)
		out += `\\${sepBuffer}`;

	return out;
}

function cleanPathComponent(component, defaultQuote = "'") {
	if (typeof component != "string")
		return "";

	const quotes = {
		"'": 0,
		"\"": 0,
		"`": 0
	};
	let maxQuote = null,
		maxCount = 0,
		enforceQuote = false;

	for (let i = 0, l = component.length; i < l; i++) {
		const char = component[i];

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
		return escape(component, /['"`\\]/g);

	const altQuote = defaultQuote == "'" ?
			"\"" :
			"'",
		quote = maxQuote && maxQuote == defaultQuote ?
			altQuote :
			defaultQuote;

	return quote + escape(component, /['"`\\]/g, maxQuote) + quote;
}

export {
	splitPath,
	joinPath,
	normalizePath,
	isPath,
	cleanPath,
	cleanSeparatedPathComponent,
	cleanPathComponent
};
