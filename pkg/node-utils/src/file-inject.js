const { isObject } = require("./utils");
const {
	readFileUTF,
	writeFile
} = require("./fs/file");

const commentMap = {
	js: {
		single: "// $comment",
		multi: "/* $comment */"
	},
	css: {
		single: "/* $comment */",
		multi: "/* $comment */"
	},
	scss: {
		single: "// $comment",
		multi: "/* $comment */"
	}
};
const lineSplitRegex = /\n|\r/;

// Path:
// file path
//
// Config:
// matcher: (object, regex, string, function) - data matcher
// matcher object:
// {
//    matchMode: ("local", "global") - whether the matcher should match once or as many times as possible
//    pre: (regex, string, function) - assert that this matches before the body match
//    body: (regex, string, function) - body match
//    post: (regex, string, function) - assert that this matches after the body match
// }
// matchers:
// regex: global if regex has a global flag, local otherwise (overridable by matchMode)
// string: local (overridable by matchMode)
// function: global (overridable by matchMode)
//
// inject:
// content to inject in the form of the following:
// if string and "mode" is "newline", the string will be inserted at the next line
// if string and "mode" is "inline", the string will replace the matched string fully
// if function, the supplied function will receive parsed data and returns a string, which
// is handled like the string equivalent
// 
// The above may also be supplied in an array. In that case, the procedure will be applied
// in order, and will wrap around if more matches than 
//
// mode: ("inline", "newline", default: "newline") - where to inject after matching
// injectMode: (string, default: "replace") - how to inject in inline mode
// injection modes:
// replace: replace full match
// start: inject at match start
// end: inject at match end
//
// globalLine: (boolean) - match globally within local lines. Also allows pre/post
//             submatchers to match on the same line
// matchScope: (number, default: Infinity) - scope of the match, that is, the maximum distance
//             in lines between submatches. Example: 0 for single line matching only
// indent: (number, string, array, default: 0) - amount to indent by. If string, the supplied indent
//         will be used either to resolve a contextual indent, or a static indent for all injected
//         lines. If number, it will infer the indent from the document and produce an appropriate indentation
//         If array, it will add the resolved intents from the contents within it
// lang: (string, default: "js") - target file type, used to add comments
// annotate: (boolean, default: true) - injects comments on either side (or at the end of injection) to
//           annotate the injection for clarity and easier later removal
// pad: (string, default: " ") - padding between annotations and content
// verticalPad: (number, object, default: 0) - insert vertical padding (blank lines) in newline mode
//              If number, inserts equal number of blank lines before and after injection
//              If object, the keys top and bottom respectively insert on either end
// autoRemove: (boolean, default: false) - Automatically remove previous replacements with the same ID

async function fileInject(pth, config = {}) {
	const fileData = await readFileUTF(pth);

	const lineData = getLineData(fileData.split(lineSplitRegex)),
		matches = match(lineData, config),
		linesOut = inject(lineData, matches, config);

	return writeFile(pth, joinLines(linesOut));
}

// Similar to fileInject, but in this case the config is given in
// an array, and lines are buffered between matches, saving expensive line
// processing 
async function bufferedFileInject(pth, configs = []) {
	const fileData = await readFileUTF(pth);
	const lineData = getLineData(fileData.split(lineSplitRegex));

	for (let i = 0, l = configs.length; i < l; i++) {
		const matches = match(lineData, configs[i]);
		inject(lineData, matches, configs[i]);
	}

	return writeFile(pth, joinLines(lineData.lines));
}

function match(lineData, config) {
	const lines = lineData.lines,
		matcher = config.matcher,
		matchMode = getMatchMode(matcher),
		useScope = typeof config.matchScope == "number" && !isNaN(config.matchScope) && config.matchScope >= 0,
		matches = [];

	let matcherObj = mkMatcherObj(matcher),
		lineNo = 0;

	while (lineNo < lines.length) {
		const currentMatcherObj = matcherObj,
			matchSuccess = matchLine(matcherObj, lines[lineNo], lineNo, matcherObj.lastIndex);

		// Invalidate on out-of-scope and start a new matcher object
		// Then backtrack to after the first match and try again
		if (useScope && matcherObj.lastLineNo > -1 && lineNo - matcherObj.lastLineNo > config.matchScope) {
			matcherObj = mkMatcherObj(matcher);
			matcherObj.lastIndex = currentMatcherObj.initialMatch.endIdx;
			lineNo = currentMatcherObj.initialMatch.lineNo;
			continue;
		}

		if (matchSuccess) {
			matcherObj.lastLineNo = lineNo;

			if (matcherObj.finished) {
				matches.push(matcherObj);

				if (matchMode == "local")
					break;

				matcherObj = mkMatcherObj(matcher);
				matcherObj.lastIndex = currentMatcherObj.lastIndex;
			}
		}
		
		if (!matchSuccess || !config.globalLine) {
			matcherObj.lastIndex = 0;
			lineNo++;
		}
	}

	return matches;
}

function inject(lineData, matches, config) {
	if (config.annotate !== false && !config.id)
		throw new Error("Annotated injections must have a valid ID");

	const lines = lineData.lines;

	for (let i = matches.length - 1; i >= 0; i--) {
		const match = matches[i],
			inj = config.injection,
			injGen = Array.isArray(inj) ? inj[i % inj.length] : inj,
			injectionPrecursor = typeof injGen == "function" ?
				injGen({
					match,
					config,
					lines
				}) :
				injGen,
				injection = formatInjection(injectionPrecursor, config);

		const injectArgs = {
			match,
			injection,
			config,
			lineData,
			padding: config.annotate === false ? "" : (config.pad == null ? " " : config.pad),
			uuid: i,
			annotate: mkAnnotationGetter(i, config)
		};

		switch (config.mode) {
			case "inline":
				injectInline(injectArgs);
				break;

			case "newline":
			default:
				injectNewline(injectArgs);
				break;
		}
	}

	return lines;
}

function injectInline(args) {
	const {
		injection,
		match,
		padding,
		config,
		lineData,
		annotate
	} = args;
	const line = match.line,
		lineStr = line.data,
		startStr = config.injectMode == "end" ?
			lineStr.substring(0, match.start) + match.match :
			lineStr.substring(0, match.start),
		endStr = config.injectMode == "start" ?
			match.match + lineStr.substring(match.end) :
			lineStr.substring(match.end);

	if (injection.length == 1) {
		const injectStr = `${padding}${annotate("il-start")}${padding}${injection[0]}${padding}${annotate("il-end")}${padding}`;
		updateLine(
			line,
			startStr + injectStr + endStr
		);
	} else {
		const indent = resolveIndent(lineData, match, config),
			lastLine = injection[injection.length - 1];

		// First line
		updateLine(
			line,
			`${startStr}${padding}${annotate("ilm-start")}${padding}${injection[0]}`
		);

		// Last line
		spliceLine(
			lineData,
			match.lineNo + 1,
			`${indent}${lastLine}${padding}${annotate("ilm-end")}${padding}${endStr}`
		);

		// Lines in between
		for (let i = injection.length - 2; i > 0; i--) {
			spliceLine(
				lineData,
				match.lineNo + 1,
				`${indent}${injection[i]}`
			);
		}
	}
}

function injectNewline(args) {
	const {
		injection,
		match,
		padding,
		config,
		lineData,
		annotate
	} = args;
	
	const indent = resolveIndent(lineData, match, config);

	// Bottom padding
	addVerticalPadding(lineData, match.lineNo + 1, config, "bottom");
				
	if (injection.length == 1) {
		spliceLine(
			lineData,
			match.lineNo + 1,
			`${indent}${injection[0]}${padding}${annotate("nl-single", "single")}`
		);
	} else {
		// Last line
		if (config.annotate !== false) {
			spliceLine(
				lineData,
				match.lineNo + 1,
				`${indent}${annotate("nlm-end", "single")}`
			);
		}

		// Lines in between
		for (let i = injection.length - 1; i >= 0; i--) {
			spliceLine(
				lineData,
				match.lineNo + 1,
				`${indent}${injection[i]}`
			);
		}
		
		// First line
		if (config.annotate !== false) {
			spliceLine(
				lineData,
				match.lineNo + 1,
				`${indent}${annotate("nlm-start", "single")}`
			);
		}
	}

	// Top padding
	addVerticalPadding(lineData, match.lineNo + 1, config, "top");
}

function getMatcherType(matcher) {
	if (!matcher)
		return null;

	if (matcher instanceof RegExp)
		return "regex";

	switch (typeof matcher) {
		case "string":
			return "local";
		case "function":
			return "global";
		case "object":
			return "object";
	}

	return null;
}

function getMatchMode(matcher) {
	switch (getMatcherType(matcher)) {
		case "regex":
			return matcher.flags.indexOf("g") == -1 ? "local" : "global";
		case "string":
			return "local";
		case "function":
			return "global";
		case "object":
			if (matcher.matchMode)
				return matcher.matchMode;
			return getMatchMode(matcher.body);
		default:
			throw new Error("Invalid matcher");
	}
}

function assertValidSubMatcher(matcher) {
	const type = getMatcherType(matcher);

	if (!type)
		throw new Error("Invalid matcher");
	if (type == "object")
		throw new Error(`Invalid matcher: submatchers may not be object matchers`);
}

function mkMatcherObj(matcher) {
	let order = null;

	if (isObject(matcher)) {
		order = [];

		if (matcher.hasOwnProperty("pre")) {
			assertValidSubMatcher(matcher.pre);
			order.push("pre");
		}

		assertValidSubMatcher(matcher.body);
		order.push("body");

		if (matcher.hasOwnProperty("post")) {
			assertValidSubMatcher(matcher.post);
			order.push("post");
		}
	} else {
		order = ["body"];

		matcher = {
			body: matcher
		};
	}

	return {
		matcher,
		order,
		orderPtr: 0,
		line: null,
		lineNo: -1,
		start: -1,
		end: -1,
		finished: false,
		match: null,
		lastIndex: 0,
		initialMatch: null,
		lastLineNo: -1
	};
}

function matchLine(matcherObj, line, lineNo, startIdx = 0) {
	const matcherName = matcherObj.order[matcherObj.orderPtr],
		matcher = matcherObj.matcher[matcherName],
		matcherType = getMatcherType(matcher),
		testStr = line.data.substring(startIdx);

	const dispatchMatch = (idx, match) => {
		const absStartIdx = startIdx + idx,
			absEndIdx = absStartIdx + match.length;

		if (matcherName == "body") {
			matcherObj.line = line;
			matcherObj.lineNo = lineNo;
			matcherObj.match = match;
			matcherObj.start = absStartIdx;
			matcherObj.end = absEndIdx;
		}

		if (!matcherObj.initialMatch) {
			matcherObj.initialMatch = {
				line,
				lineNo: lineNo,
				endIdx: absEndIdx
			};
		}

		matcherObj.orderPtr++;
		matcherObj.lastIndex = absEndIdx;
		matcherObj.finished = matcherObj.orderPtr == matcherObj.order.length;

		return true;
	};

	switch (matcherType) {
		case "regex": {
			matcher.lastIndex = 0;
			const ex = matcher.exec(testStr);
			if (ex)
				return dispatchMatch(ex.index, ex[0]);
			break;
		}

		case "string": {
			const idx = testStr.indexOf(matcher);
			if (idx > -1)
				return dispatchMatch(idx, matcher);
			break;
		}

		case "function": {
			const result = matcher({
				testStr,
				line,
				lineNo,
				matcherObj
			});
			
			switch (getMatchResultMode(result)) {
				case "regex":
					return dispatchMatch(result.index, result[0]);
				case "object":
					return dispatchMatch(result.index, result.match);
			}
			
			break;
		}
	}

	return false;
}

function getMatchResultMode(result) {
	if (!result)
		return null;

	// Regex exec result
	if (Array.isArray(result) && result.hasOwnProperty("groups"))
		return "regex";

	if (isObject(result) && result.hasOwnProperty("match"))
		return "object";

	return null;
}

const indentRegex = /^(?:\t| )*/;

function getIndent(line) {
	return indentRegex.exec(line)[0];
}

function getLineData(lines) {
	const lineData = {
		indent: "\t",
		indentComponentWidth: 1,
		indentType: "tabs",
		lines: [],
		indentWidths: {
			tabs: [],
			spaces: []
		},
		indentTypesCount: {
			tabs: 0,
			spaces: 0
		},
		indentsWithTabs: 0,
		indentsWithSpaces: 0
	};

	for (let i = 0, l = lines.length; i < l; i++) {
		lineData.lines.push(
			initLine(lines[i], lineData)
		);
	}

	// Infer indent
	const tabsCount = lineData.indentTypesCount.tabs,
		spacesCount = lineData.indentTypesCount.spaces;
	let smallestIndent = 0;

	if (spacesCount > tabsCount) {
		const list = lineData.indentWidths.spaces;

		// Find the smallest non-zero width indent
		for (let i = 0, l = list.length; i < l; i++) {
			if (list[i]) {
				smallestIndent = i;
				break;
			}
		}
	}

	if (smallestIndent) {
		lineData.indentComponentWidth = smallestIndent;
		lineData.indent = " ";
		lineData.indentType = "tabs";
		
		for (let i = lineData.lines.length - 1; i >= 0; i--)
			lineData.lines[i].indentWidth /= smallestIndent;
	}

	return lineData;
}

function initLine(data, owner) {
	const indent = getIndent(data),
		indentType = indent ? (indent[0] == "\t" ? "tabs" : "spaces") : null;

	if (indentType) {
		owner.indentTypesCount[indentType]++;
		owner.indentWidths[indentType][indent.length] = (owner.indentWidths[indentType][indent.length] || 0) + 1;
	}

	return {
		owner,
		data,
		content: data.substring(indent.length),
		indent,
		indentType,
		indentWidth: indent.length,
		isBlank: data == indent
	};
}

function updateLine(line, data) {
	if (data == null)
		data = line.data;

	const indent = getIndent(data);

	line.data = data;
	line.content = data.substring(indent.length);
	line.indent = indent;
	line.indentWidth = indent.length / line.owner.indentComponentWidth;
	line.isBlank = data == indent;
}

function spliceLine(lineData, idx, data) {
	const line = initLine(data, lineData);
	updateLine(line);

	lineData.lines.splice(idx, 0, line);
}

function addVerticalPadding(lineData, idx, config, key) {
	const padder = config.verticalPad;

	if (typeof padder != "number" && (!isObject(padder) || !padder.hasOwnProperty(key)))
		return;

	let count = Number(typeof padder == "number" ? padder : padder[key]) || 0;

	while (count--)
		spliceLine(lineData, idx, "");
}

function joinLines(lines) {
	let out = "";

	for (let i = 0, l = lines.length; i < l; i++) {
		out += lines[i].data;

		if (i != l - 1)
			out += "\n";
	}

	return out;
}

function resolveIndent(lineData, match, config) {
	const line = match.line;

	const resolve = indent => {
		switch (typeof indent) {
			case "number":
				return lineData.indent.repeat(lineData.indentComponentWidth * indent);
			case "string":
				switch (indent) {
					case "prev":
						return lineData.lines[Math.max(match.lineNo - 1, 0)].indent;
					case "next":
						return lineData.lines[Math.min(match.lineNo + 1, lineData.lines.length - 1)].indent;
					case "inherit":
						return line.indent;
				}

				return indent;
			case "object":
				if (Array.isArray(indent)) {
					let indentOut = "";
					for (let i = 0, l = indent.length; i < l; i++)
						indentOut += resolve(indent[i]);
					return indentOut;
				}

				break;
		}

		return "";
	};

	return resolve(config.indent);
}

function mkAnnotationGetter(uuid, config) {
	return (mode, commentType = "multi") => {
		if (config.annotate === false)
			return "";

		const map = commentMap[config.lang] || commentMap.js,
			template = map[commentType] || map.multi;

		return template.replace("$comment", `${mode}@qin#${config.id}/${uuid}`);
	};
}

function formatInjection(injection) {
	if (!Array.isArray(injection))
		injection = [injection];

	const injectionOut = [];

	for (let i = 0, l = injection.length; i < l; i++) {
		const split = String(injection[i]).split(lineSplitRegex);

		for (let j = 0, l2 = split.length; j < l2; j++)
			injectionOut.push(split[j]);
	}

	return injectionOut;
}

module.exports = {
	fileInject,
	bufferedFileInject,
	fileInjectUtils: {
		match,
		inject
	}
};
