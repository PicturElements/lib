import {
	get,
	splitPath,
	isObj,
	sym,
	padStart,
	resolveVal
} from "@qtxr/utils";

// Capturing groups:
// 1: variable
// 2: variable start
// 3: formatter
// 4: internal to ensure formatter is formed with the same characters
// 5: selector name
// 6: new selector term
// 7: format reference
// 8: openers
// 9: terminators
// 10: boolean operators

// Because regexes store their last index when the global flag is enabled, trying to use them in
// recursive functions may cause problems. Regex literals in inner scopes will carry a slightly
// bigger overhead than outer scope regexes, but engines can optimize the parsing of the literal
// so that there's no significant performance difference
// 
// const formatRegex = /.../gi;  To see the full regex, check parseFormatParser
const formatterRegex = /^([a-z]*)([A-Z]*)$/,
	formatCapturingGroups = [
		// Regex groups are 1-indexed
		null,				// CG1 is a string matcher group and is not used
		"variable",			// Variable reference
		"variableArgs",		// Opening parenthesis for variable arguments
		"formatter",		// Formatter definition (eg. mm HH ss)
		null,				// CG5 is a an internal matcher to ensure a formatter is formed with the same characters
		"selector",			// Initialize new selector
		"selectorTerm",		// Start of a new selector body
		"selectorTermLabel",// Denotes a label to assign to the selector term (@lbl)
		"fmtRef",			// Reference to a separate format
		"group",			// Group of tokens
		"terminator",		// Selector / function argument / group terminators
		"operator"			// Operators (boolean, bitwise)
	],
	formatCache = {};

// current: /\\.|(["'`])(?:\\.|.)*?\1|\$([a-z0-9_.-]+)(\()?|\b(([yldhms])\5+?)\b|\[((?:\\.|(["'`])(?:\\.|.)*?\7|[^\\\]])+)\]\s*{|(}\s*{)|%([a-z0-9_.-]+)%|(\()|([})])|(\|\||&&|!|[!<>]==)/gi
// /\\.|\$([a-z0-9_.-]+)(\()?|\b(([ywdhms])\4+?)\b|\[((?:[^\\\]]|\\.)+)\]\s*{|(}\s*{)|%([a-z0-9_.-]+)%|([})])/gi
// /\\.|\$([a-z0-9_.-]+)(\()?|\b(([ywdhms])\4+?)\b|\[([a-z0-9_.-]+)\]\s*{|(}\s*{)|%([a-z0-9_.-]+)%|([})])/gi

// Term handlers describe what actions can be taken on format terms
// under certain circumstances. They are categorized by term type

// argResolvable:	describes whether this term can and should be resolved before being passed
//					as an argument to a function
// exitResolvable	describes whether this term can be resolved at the string joining step
//					of the format resolve, should a term token be passed to the joiner
const tokenData = {
	variable: {
		permissions: {
			argResolvable: true,
			exitResolvable: true
		}
	},
	formatter: {
		permissions: {
			argResolvable: false,
			exitResolvable: true
		}
	},
	selector: {
		permissions: {
			argResolvable: true,
			exitResolvable: true
		}
	},
	selectorHead: {
		permissions: {
			argResolvable: true,
			exitResolvable: true
		}
	},
	selectorTerm: {
		allowedParents: {
			selector: true
		},
		permissions: {
			argResolvable: true,
			exitResolvable: true
		}
	},
	selectorTermLabel: {
		allowedParents: {
			selectorTerm: true
		},
		permissions: {
			// No need for permissions
		}
	},
	fmtRef: {
		permissions: {
			argResolvable: true,
			exitResolvable: true
		}
	},
	smartRef: {
		permissions: {
			argResolvable: true,
			exitResolvable: true
		}
	},
	group: {
		allowedParents: {
			variable: true,
			selectorHead: true,
			group: true
		},
		permissions: {
			argResolvable: true,
			exitResolvable: true
		}
	},
	operator: {
		allowedParents: {
			selectorHead: true
		},
		ignoreParents: {
			group: true
		},
		permissions: {
			argResolvable: true,
			exitResolvable: true
		}
	}
};

const selectorCoerceMap = {
	b: "boolean",
	n: "number",
	i: "integer",
	s: "string"
};

const terminatorMap = {
	selector: "}",
	variable: ")",
	group: ")",
	selectorHead: "]"
};

const formatterClassMap = {
	Y: "year",
	L: "month",
	D: "day",
	H: "hour",
	M: "minute",
	S: "second"
};

const unaryOps = {
	"!": "NOT",
	"~": "bitwise NOT"
};

const binaryOps = {
	"|": "bitwise OR",
	"||": "OR",
	"&": "bitwise AND",
	"&&": "AND",
	"^": "bitwise XOR",
	">": "greater than",
	"<": "less than",
	"==": "equal",
	"===": "strict equal",
	"!=": "not equal",
	"!==": "strict not equal",
	">=": "greater than or equal to",
	"<=": "less than or equal to",
	"<<": "left shift",
	">>": "sign-propagating right shift",
	">>>": "zero-fill right shift"
};

function parseFormat(format) {
	if (format == null)
		return [];

	if (formatCache.hasOwnProperty(format))
		return formatCache[format];

	const parsed = parseFormatParser("" + format);
	cleanAST(parsed);

	formatCache[format] = parsed;

	return parsed;
}
 
// Tokenize, and create AST-like object
function parseFormatParser(format, currentStack) {
	const formatRegex = /\\.|(["'`])(?:\\.|.)*?\1|\$([a-z0-9_.-]+)(\()?|\b(([yldhms])\5+?)\b|((?:@[bnis])?\[)|(}?\s*{(?:@([a-z0-9_\.-]+):\s?)?)|%([a-z0-9_.-]+)%|(\()|([})\]])|(?:\s*(\|\|?|&&?|={2,3}|!==?|>>>?|<<|[<>]=?|[!~^])\s*)/gi,
		outStruct = [],
		structStack = currentStack || [],
		stackLen = structStack.length;
	let struct = outStruct,
		ptr = 0;

	while (true) {
		const ex = formatRegex.exec(format);
		if (!ex)
			break;

		if (ex.index > ptr) {
			struct.push(format.substr(ptr, ex.index - ptr));
			ptr = ex.index;
		}

		const { label, capture } = getCapturingData(ex, formatCapturingGroups),
			allowedChild = allowedChildToken(label, structStack),
			match = ex[0];

		switch (label) {
			case "variable":					// Variable injection - $variable
				const variable = mkToken({
					type: "variable",
					value: capture,
					parent: struct,
					args: []
				}, ex);

				// Args alias
				variable.children = variable.args;

				struct.push(variable);

				const argParen = getCapturingMatch(ex, formatCapturingGroups, "variableArgs");
				if (argParen !== undefined) {
					variable.parent = struct;
					structStack.push(variable);
					struct = variable.args;
				}
				break;

			case "formatter":					// date formatters - YY / yy / ll / HH
				const formatter = formatterRegex.exec(capture);

				if (!formatter)
					throw new SyntaxError(`parser@${ptr}: '${capture}' is not a valid formatter. A valid formatter consists of an arbitrary number (including 0) of soft pads (lower case) and hard pads (upper case), in that order`);

				struct.push(mkToken({
					type: "formatter",
					value: capture,
					length: capture.length,
					class: formatterClassMap[capture[0].toUpperCase()],
					pad: {
						soft: formatter[1].length,
						hard: formatter[2].length
					}
				}, ex));
				break;

			case "selector":					// selector - [index (boolean, num, function)]{
				const selector = mkToken({
						type: "selector",
						parent: struct,
						expr: [],
						terms: [],
						coerce: selectorCoerceMap[capture[1]] || "none"
					}, ex),
					selectorHead = mkToken({
						type: "selectorHead",
						parent: struct,
						selector
					});
	
				// Terms alias
				selector.children = selector.terms;
	
				struct.push(selector);
				structStack.push(selector, selectorHead);

				struct = selector.expr;
				break;

			case "selectorTerm":				// new selector term {term}
				if (allowedChild) {
					const currentStruct = structStack[structStack.length - 1];

					if (!currentStruct)
						throw new SyntaxError(`parser@${ptr}: Cannot create new selector item: no selector is initialized`);
					if (currentStruct.type != "selector")
						throw new SyntaxError(`parser@${ptr}: Unexpected new selector`);

					const term = {
						label: getCapturingMatch(ex, formatCapturingGroups, "selectorTermLabel") || null,
						term: []
					};
					currentStruct.terms.push(term);
					struct = term.term;
				} else
					struct.push(match);
				break;

			case "fmtRef":
				struct.push(mkToken({
					type: "fmtRef",
					value: capture
				}, ex));
				break;

			case "terminator": {
				const token = structStack[structStack.length - 1],
					mapItem = token && terminatorMap[token.type],
					terminatorMatch = mapItem && (mapItem instanceof RegExp ? mapItem.test(capture) : mapItem == capture);

				if (terminatorMatch) {
					token.literal = format.substr(token.index, ex.index + capture.length - token.index);
					structStack.pop();
					struct = token.parent;
					delete token.parent;
				// If the current stack item isn't of the correct type, treat terminator as a character.
				} else
					struct.push(capture);
				break;
			}

			case "group":
				if (allowedChild) {
					const group = mkGroup();

					struct.push(group);
					structStack.push(group);
					group.parent = struct;
					struct = group.children;
				} else
					struct.push(match);
				break;

			case "operator":
				if (allowedChild) {
					const op = mkToken({
						type: "operator",
						value: capture,
						name: null,
						unary: false
					}, ex);

					if (unaryOps.hasOwnProperty(capture)) {
						op.unary = true;
						op.name = unaryOps[capture];
					}

					if (binaryOps.hasOwnProperty(capture))
						op.name = binaryOps[capture];

					struct.push(op);
				} else
					struct.push(match);
			break;

			default:
				switch (match[0]) {	// escaped character, etc - \.
					case "\\":
						struct.push(match[1]);
						break;
					default:
						struct.push(match);
				}
		}

		ptr += match.length;
	}

	if (ptr < format.length)
		struct.push(format.substr(ptr, format.length - ptr));

	if (structStack.length > stackLen)
		throw new SyntaxError(`Invalid format '${format}': (unterminated ${structStack[structStack.length - 1].type})`);
	if (structStack.length < stackLen)
		throw new SyntaxError(`Invalid format '${format}': (unexpected ${structStack[structStack.length - 1].type})`);

	// console.log(outStruct);
	return outStruct;
}

function mkToken(tokenData = {}, ex = null) {
	tokenData.formatToken = true;
	if (ex && ex.hasOwnProperty("index"))
		tokenData.index = ex.index;
	
	return tokenData;
}

function mkSmartRef(value) {
	return mkToken({
		type: "smartRef",
		value
	});
}

function mkGroup(children = []) {
	return mkToken({
		type: "group",
		children
	});
}

function getCapturingData(ex, labels) {
	for (let i = 0, l = labels.length; i < l; i++) {
		if (labels[i] !== null && ex[i + 1] !== undefined) {
			return {
				label: labels[i],
				capture: ex[i + 1],
				capturingIndex: i + 1
			};
		}
	}

	return {
		label: null,
		capture: null,
		capturingIndex: -1
	};
}

function getCapturingMatch(ex, labels, label) {
	const idx = labels.indexOf(label);
	if (idx < 0)
		return undefined;

	return ex[idx + 1];
}

function allowedChildToken(tokenType, structStack) {
	const partition = tokenData[tokenType];
	let endStruct = structStack[structStack.length - 1];

	if (partition && partition.ignoreParents) {
		let sIdx = structStack.length;
		while (sIdx > 0 && partition.ignoreParents.hasOwnProperty(structStack[--sIdx].type));
		endStruct = structStack[sIdx];
	}

	if (!partition)
		return false;

	if (!endStruct)
		return !!partition.allowNullParent;

	let allowed = partition.allowedParents ? partition.allowedParents.hasOwnProperty(endStruct.type) : true;
	allowed = allowed && (partition.disAllowedParents ? !partition.disAllowedParents.hasOwnProperty(endStruct.type) : true);

	return allowed;
}

function cleanAST(parsed) {
	for (let i = parsed.length - 1; i >= 0; i--) {
		const currTerm = parsed[i];

		cASTJoinStr(parsed, currTerm, i);

		if (!isFmt(currTerm))
			continue;

		if (currTerm.hasOwnProperty("children"))
			cleanAST(currTerm.children, currTerm, i);
		
		switch (currTerm.type) {
			case "variable":
				currTerm.args = currTerm.children = flattenGroups(currTerm.args);
				cASTFormatArgs(currTerm.args);
				break;
			case "selector":
				currTerm.terms.forEach(t => cleanAST(t.term));
				cleanAST(currTerm.expr);
				cASTFormatExpr(currTerm.expr);
				cASTAtomizeExpr(currTerm.expr);
				break;
		}
	}
}

function cASTJoinStr(parsed, currTerm, idx) {
	const nextTerm = parsed[idx + 1];

	if (typeof currTerm == "string" && typeof nextTerm == "string") {
		parsed[idx] = currTerm + nextTerm;
		parsed.splice(idx + 1, 1);
	}
}

function cASTFormatArgs(args) {
	for (let i = args.length - 1; i >= 0; i--) {
		let arg = args[i];

		if (typeof arg != "string")
			continue;

		arg = arg.trim();

		if (!arg)
			args.splice(i, 1);
		else 
			args.splice(i, 1, ...splitArgStr(arg, i > 0, i < args.length - 1));
	}
}

const splitArgRegex = /(["'`])((?:\\.|.)*?)\1|[^,\s]+|(,)/g;

function splitArgStr(str, hasPrevArg, hasNextArg) {
	const argsOut = [];
	let ptr = 0,
		lastOp = 0;		// 0: unititialized, 1: comma, 2: argument
	
	while (true) {
		const ex = splitArgRegex.exec(str);
		if (!ex)
			break;

		// Matches comma
		if (ex[3]) {
			if (lastOp || !hasPrevArg)
				argsOut[++ptr] = undefined;

			lastOp = 1;
		} else {
			argsOut[ptr] = toLiteral(ex[0], true);

			lastOp = 2;
		}
	}

	if (lastOp == 1) {
		if (hasNextArg)
			argsOut.pop();
		else if (str.length == 1)
			argsOut.push(undefined);
	}

	return argsOut;
}

function cASTFormatExpr(expr) {
	let nextOpIdx = 1;

	for (let i = 0, l = expr.length; i < l; i++) {
		const item = expr[i],
			isOp = isFmt(item, "operator");

		if (isOp) {
			if (!item.unary && i != nextOpIdx)
				throw new SyntaxError("Invalid boolean expression: unexpected binary operator");
			if (item.unary && i > 0 && !isFmt(expr[i - 1], "operator"))
				throw new SyntaxError("Invalid boolean expression: unexpected unary operator");
			if (i == l - 1)
				throw new SyntaxError("Invalid boolean expression: found terminating operator");
		} else {
			if (i == nextOpIdx)
				throw new SyntaxError("Invalid boolean expression: expected an operator, but got a value");
		}

		if (isOp)
			nextOpIdx += item.unary ? 1 : 2;

		if (isFmt(item, "group"))
			cASTFormatExpr(item.children);
		else if (typeof item == "string")
			expr[i] = toLiteral(item, true);
	}
}

const andOr = {
	AND: true,
	OR: true
};

// Bundle together AND terms to aid short circuit evaluation
// Reason:
// 1	2	 3	  4
// F && F || T && F evaluates 1 - 3 - 4
// F || F && T || F evaluates 1 - 2 - 4
// T || F && T || F only evaluates 1
function cASTAtomizeExpr(expr) {
	let lastNonOpIdx = -1,
		running = false;

	// Bundle non-AND/OR and recursively call the atomizer
	for (let i = expr.length - 1; i >= 0; i--) {
		const item = expr[i];

		if (isFmt(item, "operator")) {
			if (andOr.hasOwnProperty(item.name))
				tryBundle(i + 1);
			else
				running = true;
		} else {
			if (isFmt(item, "group"))
				cASTAtomizeExpr(item.children);
			if (!running)
				lastNonOpIdx = i; 
		}
	}

	tryBundle(0);
	running = false;

	// Bundle AND
	for (let i = expr.length - 1; i >= 0; i--) {
		const item = expr[i];

		if (isFmt(item, "operator")) {
			if (item.name != "AND")
				tryBundle(i + 1);
			else
				running = true;
		} else if (!running)
			lastNonOpIdx = i;
	}

	tryBundle(0);

	function tryBundle(idx) {
		if (!running || lastNonOpIdx - idx < 2 || (idx == 0 && lastNonOpIdx == expr.length - 1))
			return;

		const items = expr.splice(idx, lastNonOpIdx - idx + 1, 0);	// 0 is a placeholder
		expr[idx] = mkGroup(items);
		
		running = false;		
	}
}

const stringMatchRegex = /^(["'`])((?:\\.|.)*?)\1$/,
	constantLiterals = {
		true: true,
		false: false,
		null: null,
		NaN: NaN,
		undefined: undefined
	};

function toLiteral(str, defaultToSmartRef) {
	const ex = stringMatchRegex.exec(str);

	if (ex)
		return ex[2];
	if (constantLiterals.hasOwnProperty(str))
		return constantLiterals[str];
	if (!isNaN(Number(str)))
		return Number(str);
	// If the defaultToSmartRef flag is truthy, return a format
	// term that can be resolved to a value, or fall back as a string.
	// This form is used in function invocations where ideally strings should be quoted
	// but where it may be useful to refer to variables without the $ syntax
	// or use strings without quotes for legibility
	if (defaultToSmartRef)
		return mkSmartRef(str);
	
	return str;
}

function flattenGroups(arr, depth = Infinity, out = []) {
	for (let i = 0, l = arr.length; i < l; i++) {
		const item = arr[i];

		if (depth > 0 && isFmt(item, "group"))
			flattenGroups(item.children, depth - 1, out);
		else
			out.push(item);
	}

	return out;
}

function resolveFormat(parsedFormat, meta) {
	const store = meta.store,
		formatArgs = meta;

	// Resolves to a string
	function resolve(parsed) {
		if (parsed == null)
			return "";

		let out = "";

		for (let i = 0, l = parsed.length; i < l; i++) {
			let resolved = resolveToken(parsed[i]);

			if (resolved == null)
				continue;

			// If a raw format item has made its way through, resolve it again.
			if (queryPermissions(resolved, "exitResolvable"))
				resolved = resolveToken(resolved);
			if (Array.isArray(resolved))
				resolved = resolve(resolved);

			out += resolved;
		}

		return out;
	}

	// Resolves to any type
	function resolveToken(fmt) {
		if (!isFmt(fmt))
			return fmt;

		switch (fmt.type) {
			case "variable":
				return resolveRef(store, fmt.value, formatArgs, resolveArgs(resolveToken, fmt.args));
			
			case "formatter":
				return padFormatter(getFormatterUnit(store.date, fmt.class), fmt);
				
			case "smartRef":
				const value = resolveRef(store, fmt.value, formatArgs);
				if (value === undefined)
					return fmt.value;
				return value;

			case "fmtRef":
				// This is used to pass a correct format trace
				// It could be done by calling resolveFormat with an updated
				// meta object, but to save processing we can just change the trace
				// data temporarily.
				const fTrace = meta.formatTrace;

				meta.formatTrace = resolveRefTrace(fTrace, fmt.value, formatArgs);
				
				const parsed = parseFormat(meta.formatTrace.data),
					resolved = resolve(parsed);

				meta.formatScope = fTrace;

				return resolved;

			case "selector":
				let exprVal = resolveExpr(resolveToken, fmt.expr),
					term = null;

				switch (fmt.coerce) {
					case "boolean":
						exprVal = Boolean(exprVal);
						break;
					case "string":
						exprVal = String(exprVal);
						break;
					case "number":
					case "integer":
						exprVal = Number(exprVal);
						if (isNaN(exprVal))
							exprVal = -1;
						/* falls through */
					case "integer":
						exprVal = Math.floor(exprVal);
						break;
				}

				switch (typeof exprVal) {
					case "boolean":
						term = fmt.terms[+!exprVal];
						break;
					case "number":
						term = fmt.terms[exprVal];
						break;
					case "string":
						term = fmt.terms.find(t => t.label == exprVal);
						break;
				}

			return term ? term.term : "";
		}
	}

	return resolve(parsedFormat);
}

function resolveArgs(resolveToken, args) {
	return args.map(arg => {
		if (queryPermissions(arg, "argResolvable"))
			return resolveToken(arg);
		return arg;
	});
}

function resolveExpr(resolveToken, expr) {
	let idx = 0,
		sCircOp = null,
		val = evalTape();

	while (idx < expr.length) {
		const nextVal = evalTape();

		if (sCircOp && ((sCircOp == "AND" && !val) || (sCircOp == "OR" && val)))
			return val;

		val = nextVal;
	}

	function evalTape() {
		const item = expr[idx++];

		if (isFmt(item, "group"))
			return resolveExpr(resolveToken, item.children);

		if (!isFmt(item, "operator"))
			return resolveToken(item);

		switch (item.value) {
			case "!":
				return !evalTape();
			case "~":
				return ~evalTape();
			case "|":
				return val | evalTape();
			case "||":
				sCircOp = "OR";
				return val || evalTape();
			case "&":
				return val & evalTape();
			case "&&":
				sCircOp = "AND";
				return val && evalTape();
			case "^":
				return val ^ evalTape();
			case ">":
				return val > evalTape();
			case "<":
				return val < evalTape();
			case "==":
				return val == evalTape();
			case "===":
				return val === evalTape();
			case "!=":
				return val != evalTape();
			case "!==":
				return val !== evalTape();
			case ">=":
				return val >= evalTape();
			case "<=":
				return val <= evalTape();
			case "<<":
				return val << evalTape();
			case ">>":
				return val >> evalTape();
			case ">>>":
				return val >>> evalTape();
		}
	}

	return val;
}

function resolveRef(store, ref, formatArgs, args = []) {
	let item = get(store, ref, undefined, "context");

	if (typeof item.data == "function") {
		const v = item.context[item.key](formatArgs, ...args);
		return v;
	}

	return item.data;
}

function resolveRefCaller(store, ref, formatArgs, ...args) {
	let item = get(store, ref, undefined, "context");

	if (typeof item.data == "function")
		item.data =  item.context[item.key](formatArgs, ...args);

	return item;
}

const isTraceObj = sym("isTraceObj"),
	stepRegex = /^\.*/;

function resolveRefTrace(store, refOrPath, formatArgs, args = []) {
	let steps = 0,
		path = refOrPath;

	if (typeof refOrPath == "string") {
		steps = stepRegex.exec(refOrPath)[0].length;
		path = splitPath(refOrPath.substr(steps));
	}

	if (store && store[isTraceObj]) {
		// If the store data is an object, treat it like a directory, so that
		// any new path uses it as its root
		// Otherwise, it's a leaf node, so step one step up in the path and root that
		const dirStep = isObj(store.data) ? 0 : 1,
			sliceEnd = (-steps - dirStep) || store.path.length;

		path = store.path.slice(0, sliceEnd).concat(path);
		store = store.store;
	}

	let item = get(store, path, undefined, "context");

	item.data = resolveVal(item.data, formatArgs, ...args);
	item.store = store;
	item.path = path;
	item[isTraceObj] = true;

	return item;
}

function isFmt(candidate, type) {
	if (!candidate)
		return false;

	if (typeof type == "string")
		return candidate.hasOwnProperty("formatToken") && candidate.type == type;

	return candidate.hasOwnProperty("formatToken");
}

function queryPermissions(fmt, action) {
	if (!fmt || !fmt.formatToken)
		return false;

	const partition = tokenData[fmt.type];
	
	if (!partition)
		return false;

	return !!partition.permissions[action];
}

function getFormatterUnit(date, cls) {
	switch (cls) {
		case "year":
			return date.getFullYear();
		case "month":
			return date.getMonth() + 1;
		case "day":
			return date.getDate();
		case "hour":
			return date.getHours();
		case "minute":
			return date.getMinutes();
		case "second":
			return date.getSeconds();
	}
}

function padFormatter(num, formatter) {
	num = "" + num;
	const pad = formatter.pad;

	num = Number(num.substr(Math.max(num.length - (pad.hard + pad.soft), 0)));
	return padStart(num, pad.hard, "0");
}

function processFormatter(args, formatter, getter) {
	if (isFmt(formatter, "formatter")) {
		let out = getFormatterUnit(args.store.date, formatter.class);

		const outCandidate = typeof getter == "function" ? getter(true, out, formatter) : out;
		if (outCandidate !== undefined)
			out = outCandidate;

		if (typeof out == "number")
			return padFormatter(out, formatter);
		else if (typeof out == "string")
			return out;
		else if (isFmt(out, "formatter"))
			return padFormatter(getFormatterUnit(args.store.date, out.class), out);
	} else {
		const outCandidate = typeof getter == "function" ? getter(false, 0, null) : getter;
		
		if (outCandidate !== undefined)
			return outCandidate;
	}

	return formatter;
}

function passVars(vars, extraVars) {
	if (extraVars == null)
		return vars;

	return Object.assign({}, vars, extraVars);
}

export {
	parseFormat,
	resolveFormat,
	// Utils, etc
	isFmt,
	resolveRef,
	resolveRefCaller,
	resolveRefTrace,
	processFormatter,
	passVars
};
