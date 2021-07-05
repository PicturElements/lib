const https = require("https");

/* eslint-disable no-prototype-builtins */

// Miscellaneous pure utilities not pertinent to CLI, the file system, or OS
function promisify(func, paramNamesOrParamMap, returnKeyOrReturnIndex, optionsOrCallback) {
	const callback = typeof optionsOrCallback == "function" ?
			optionsOrCallback :
			(optionsOrCallback && optionsOrCallback.callback) || null,
		options = optionsOrCallback && typeof optionsOrCallback == "object" ?
			optionsOrCallback :
			{};

	const handler = (resolve, args) => {
		if (typeof callback == "function")
			callback(resolve, ...args);
		else if (isObject(paramNamesOrParamMap)) {				// Parameter name/index map
			if (args[paramNamesOrParamMap.err])
				return resolve(null);

			const retIndex = typeof returnKeyOrReturnIndex == "string" ?
				paramNamesOrParamMap[returnKeyOrReturnIndex] :
				returnKeyOrReturnIndex;

			resolve(args[retIndex]);
		} else if (Array.isArray(paramNamesOrParamMap)) {		// Parameter name list
			const namedArgs = nameArgs(args, paramNamesOrParamMap);

			if (namedArgs.err)
				return resolve(null);

			resolve(namedArgs[returnKeyOrReturnIndex]);
		} else
			resolve(args[returnKeyOrReturnIndex || 0]);
	};

	return args => {
		return new Promise(resolve => {
			switch (options.mode) {
				case "manual":
					if (typeof callback == "function")
						callback(resolve, func(...args));
					break;

				case "manual-manual-call":
					if (typeof callback == "function")
						callback(resolve, func, ...args);
					break;

				default:
					func(...args, (...a) => handler(resolve, a));
			}
		});
	};
}

function nameArgs(args, argNames) {
	const len = Math.min(args.length, argNames),
		out = {};

	for (let i = 0; i < len; i++)
		out[argNames[i]] = args[i];

	return out;
}

function isObject(val) {
	return !!val && Object.getPrototypeOf(val) == Object.prototype;
}

function resolveVal(val, ...args) {
	if (typeof val == "function")
		return val(...args);

	return val;
}

function coerceNum(num, def) {
	return typeof num == "number" && !isNaN(num) ? num : def;
}

// Returns a short string from input as a preview
function shortPrint(val, maxArrLen = 3, useArrBrackets = true) {
	switch (typeof val) {
		case "string":
			return `"${val}"`;
		case "boolean":
		case "number":
		case "bigint":
		case "undefined":
			return String(val);
		case "symbol":
			return "Symbol()";
		case "function":
			return `function ${val.name || "fn"}(){}`;
		case "object":
			if (val == null)
				return "null";

			if (isObject(val))
				return `{ ${shortPrint(Object.keys(val), maxArrLen, false)} }`;
			else if (Array.isArray(val)) {
				const arr = val.slice(0, maxArrLen).map(v => shortPrint(v, 1));

				if (arr.length < val.length)
					arr.push("...");

				return useArrBrackets ? `[${arr.join(", ")}]` : arr.join(", ");
			} else
				return val.constructor.name;
	}

	return "";
}

function repeat(str, count = 0) {
	str = String(str);
	count = Number(count) || 0;

	if (count < 0)
		throw new RangeError("Invalid count value");

	if (!count)
		return "";

	let out = "";

	// Pretty much completely ripped off the left-pad implementation
	// https://github.com/left-pad/left-pad/blob/master/index.js
	// because it's pretty elegant
	while (true) {
		if (count & 1)
			out += str;

		count >>= 1;

		if (count)
			str += str;
		else
			return out;
	}
}

function tryify(func, ...args) {
	try {
		func(...args);
		return true;
	} catch (e) {
		console.error(e);
		return false;
	}
}

function findByKey(keys, dict) {
	if (!Array.isArray(keys))
		return null;

	for (const key of keys) {
		if (dict.hasOwnProperty(key))
			return dict[key];
	}

	return null;
}

class BuildStamp {
	constructor() {
		this.builds = 0;
	}

	logBuild() {
		this.builds++;
	}

	verbose() {
		this.logBuild();
		const date = new Date(),
			dateStr = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

		return `@ ${dateStr} ${date.getDate()}/${date.getMonth() + 1} - build ${this.builds}`;
	}
}

function calcPrecedence(inp, nameMap, def) {
	switch (typeof inp) {
		case "string": {
			if (nameMap.hasOwnProperty(inp))
				return nameMap[inp];

			const precedence = Number(inp);
			return isNaN(precedence) ? def : precedence;
		}

		case "number":
			return isNaN(inp) ? def : inp;
	}

	return def;
}

function calcPrecedenceFromCLIOptions(options, nameMap, def) {
	if (options.kvOptions.hasOwnProperty("precedence"))
		return calcPrecedence(options.kvOptions.precedence, nameMap, def);

	const prec = findByKey(options.keyOptions, nameMap);
	if (prec !== null)
		return prec;

	return def;
}

function fetch(url, options) {
	options = Object.assign({}, options);

	return data => {
		let payload = data;

		if (typeof data == "object") {
			payload = JSON.stringify(data);
			options.headers = Object.assign({}, options.headers);
			options.headers["Content-Type"] = "application/json";
			options.headers["Content-Length"] = Buffer.byteLength(payload);
		}

		return new Promise(resolve => {
			const req = https.request(url, options, res => {
				res.setEncoding(options.encoding || "utf8");
				let data = "";
	
				res.on("data", chunk => data += chunk);
				res.on("end", _ => {
					if (options.json) {
						try {
							resolve(JSON.parse(data));
						} catch (e) {
							resolve(null);
						}
					} else
						resolve(data);
				});
			});
	
			req.on("error", _ => resolve(null));
	
			if (payload)
				req.write(payload);
			
			req.end();
		});
	};
}

function untab(str, tabbing = null, trim = false) {
	if (typeof tabbing == "boolean") {
		trim = tabbing;
		tabbing = null;
	}

	let split = str.split("\n"),
		indents = [],
		trimStart = 0,
		trimEnd = 0,
		foundStart = false,
		minIndentLen = Infinity;

	for (let i = 0, l = split.length; i < l; i++) {
		const s = split[i];
		let indent = "",
			tabIdx = 0;

		for (let j = 0, l2 = s.length; j < l2; j++) {
			const c = s[j];

			if (tabbing == null) {
				if (!c.trim()) {
					indent += c;
					continue;
				} else
					break;
			}

			if (tabbing[tabIdx++] == c) {
				if (tabIdx >= tabbing.length) {
					indent += tabbing;
					tabIdx = 0;
				}
			} else
				break;
		}

		if (trim && indent == s) {
			if (!foundStart)
				trimStart++;
			else {
				indents.push(null);
				trimEnd++;
			}
		} else {
			foundStart = true;
			trimEnd = 0;
			indents.push(indent);

			if (indent.length < minIndentLen)
				minIndentLen = indent.length;
		}
	}

	if (trimStart + trimEnd != 0) {
		split = split.slice(trimStart, split.length - trimEnd);
		indents.length -= trimEnd;
	}

	if (!minIndentLen)
		return split.join("\n");

	for (let i = 0, l = split.length; i < l; i++) {
		if (!indents[i])
			continue;

		split[i] = split[i].slice(minIndentLen);
	}

	return split.join("\n");
}

module.exports = {
	promisify,
	tryify,
	nameArgs,
	isObject,
	resolveVal,
	coerceNum,
	shortPrint,
	repeat,
	findByKey,
	BuildStamp,
	calcPrecedence,
	calcPrecedenceFromCLIOptions,
	fetch,
	untab
};
