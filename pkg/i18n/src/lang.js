import {
	get,
	splitPath,
	sym,
	isObj,
	hasOwn,
	lookup,
	repeat,
	padStart,
	matchType,
	resolveVal
} from "@qtxr/utils";

// Because regexes store their last index when the global flag is enabled, trying to use them in
// recursive functions may cause problems. Regex literals in inner scopes will carry a slightly
// bigger overhead than outer scope regexes, but engines can optimize the parsing of the literal
// so that there's no significant performance difference
// 
// const formatRegex = /.../gi;  To see the full regex, check parseFormatParser
const FORMATTER_REGEX = /^([a-z]*)([A-Z]*)$/,
	FORMAT_CAPTURING_GROUPS = [
		null,					// CG1 is a string matcher group and is not used
		"variable",				// Variable reference
		"variableArgs",			// Opening parenthesis for variable arguments
		"formatter",			// Formatter definition (eg. mm HH ss)
		null,					// CG5 is a an internal matcher to ensure a formatter is formed with the same characters
		"selector",				// Initialize new selector
		"selectorTerm",			// Start of a new selector body
		"selectorTermLabel",	// Denotes a label to assign to the selector term (@lbl)
		"fmtRef",				// Reference to a separate format
		"group",				// Group of tokens
		"terminator",			// Selector / function argument / group terminators
		"operator",				// Operators (boolean, bitwise, arithmetic)
		"interpolator",			// Interpolator (evaluates and returns like the head of a selector)
		"separator"				// Separates parameter tokens
	],
	FORMAT_CACHE = {};

window.FORMAT_CACHE = FORMAT_CACHE;

// current: /\\.|(["'`])(?:\\.|.)*?\1|\$((?:[a-z0-9_[\].-]|\\.)+|\((?:[a-z0-9_[\].-]|\\.)+\))(\()?|\b(([yldhms])\5+?)\b|((?:@[bnis])?\[)|(}?\s*{(?:@((?:[a-z0-9_[\].-]|\\.)+):\s?)?)|%((?:[^%\\]|\\.)+?)%|(\()|([})\]])|(?:\s*(\|\|?|&&?|={2,3}|!==?|>>>?|<<|[<>]=?|[!~^]|[+-]|\*{1,2}|\/{1,2}|\?\?|%)\s*)|(#{)|(,)/gi
// /\\.|(["'`])(?:\\.|.)*?\1|\$\(?([a-z0-9_.-]+)\)?(\()?|\b(([yldhms])\5+?)\b|((?:@[bnis])?\[)|(}?\s*{(?:@([a-z0-9_\.-]+):\s?)?)|%((?:[^%\\]|\\.)+?)%|(\()|([})\]])|(?:\s*(\|\|?|&&?|={2,3}|!==?|>>>?|<<|[<>]=?|[!~^])\s*)/gi
// /\\.|(["'`])(?:\\.|.)*?\1|\$([a-z0-9_.-]+)(\()?|\b(([yldhms])\5+?)\b|((?:@[bnis])?\[)|(}?\s*{(?:@([a-z0-9_\.-]+):\s?)?)|%([a-z0-9_.-]+)%|(\()|([})\]])|(?:\s*(\|\|?|&&?|={2,3}|!==?|>>>?|<<|[<>]=?|[!~^])\s*)/gi
// /\\.|(["'`])(?:\\.|.)*?\1|\$([a-z0-9_.-]+)(\()?|\b(([yldhms])\5+?)\b|\[((?:\\.|(["'`])(?:\\.|.)*?\7|[^\\\]])+)\]\s*{|(}\s*{)|%([a-z0-9_.-]+)%|(\()|([})])|(\|\||&&|!|[!<>]==)/gi
// /\\.|\$([a-z0-9_.-]+)(\()?|\b(([ywdhms])\4+?)\b|\[((?:[^\\\]]|\\.)+)\]\s*{|(}\s*{)|%([a-z0-9_.-]+)%|([})])/gi
// /\\.|\$([a-z0-9_.-]+)(\()?|\b(([ywdhms])\4+?)\b|\[([a-z0-9_.-]+)\]\s*{|(}\s*{)|%([a-z0-9_.-]+)%|([})])/gi

// Term handlers describe what actions can be taken on format terms
// under certain circumstances. They are categorized by term type

// argResolvable:	describes whether this term can and should be resolved before being passed
//					as an argument to a function
// exitResolvable	describes whether this term can be resolved at the string joining step
//					of the format resolve, should a term token be passed to the joiner
const TOKEN_DATA = {
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
		permissions: {}
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
			group: true,
			interpolator: true
		},
		permissions: {
			argResolvable: true,
			exitResolvable: true
		}
	},
	operator: {
		allowedParents: {
			selectorHead: true,
			interpolator: true,
			variable: true
		},
		ignoreParents: {
			group: true
		},
		permissions: {
			argResolvable: true,
			exitResolvable: true
		}
	},
	interpolator: {
		permissions: {
			argResolvable: true,
			exitResolvable: true
		}
	},
	separator: {
		allowedParents: {
			variable: true
		},
		permissions: {}
	}
};

const SELECTOR_COERCE_MAP = {
	b: "boolean",
	n: "number",
	i: "integer",
	s: "string"
};

const TERMINATOR_MAP = {
	selector: "}",
	variable: ")",
	group: ")",
	selectorHead: "]",
	interpolator: "}"
};

const FORMATTER_CLASS_MAP = {
	Y: "year",
	L: "month",
	D: "day",
	H: "hour",
	M: "minute",
	S: "second"
};

const UNARY_OPS = {
	"!": "NOT",
	"~": "bitwise NOT"
};

const BINARY_OPS = {
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
	">>>": "zero-fill right shift",
	"+": "addition",
	"-": "subtraction",
	"*": "multiplication",
	"/": "division",
	"//": "floor division",
	"**": "power",
	"??": "null coalesce",
	"%": "modulo"
};

const UNARY_CONVERTIBLE_OPS = {
	"+": "casting",
	"-": "inversion"
};

const AND_OR = lookup(["&&", "||"]);

const OP_PRECEDENCE = [
	lookup("&&"),
	lookup("**"),
	lookup(["*", "/", "//", "%"]),
	lookup(["+", "-"]),
	lookup(["<", ">", "<<", ">>", ">>>", ">=", "<=", "==", "===", "!=", "!=="]),
	lookup(["^", "&", "|"]),
	lookup("??")
];

function parseFormat(format) {
	if (format == null)
		return [];

	if (hasOwn(FORMAT_CACHE, format))
		return FORMAT_CACHE[format];

	const parsed = parseFormatParser("" + format);
	cleanAST(parsed);

	FORMAT_CACHE[format] = parsed;

	return parsed;
}
 
// Tokenize, and create AST-like object
function parseFormatParser(format, currentStack) {
	const formatRegex = /\\.|(["'`])(?:\\.|.)*?\1|\$((?:[a-z0-9_[\].-]|\\.)+|\((?:[a-z0-9_[\].-]|\\.)+\))(\()?|\b(([yldhms])\5+?)\b|((?:@[bnis])?\[)|(}?\s*{(?:@((?:[a-z0-9_[\].-]|\\.)+):\s?)?)|%((?:[^%\\]|\\.)+?)%|(\()|([})\]])|(?:\s*(\|\|?|&&?|={2,3}|!==?|>>>?|<<|[<>]=?|[!~^]|[+-]|\*{1,2}|\/{1,2}|\?\?|%)\s*)|(#{)|(,)/gi,
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

		const { label, capture } = getCapturingData(ex, FORMAT_CAPTURING_GROUPS),
			allowedChild = allowedChildToken(label, structStack),
			match = ex[0];

		switch (label) {
			// Variable injection - $variable / $(variable)
			case "variable": {
				const variable = mkToken({
					type: "variable",
					value: capture[0] == "(" ?
						capture.substr(1, capture.length - 2) :
						capture,
					args: [],
					invoking: false
				}, ex);

				// Args alias
				variable.children = variable.args;

				struct.push(variable);

				const argParen = getCapturingMatch(ex, FORMAT_CAPTURING_GROUPS, "variableArgs");
				if (argParen !== undefined) {
					variable.parent = struct;
					structStack.push(variable);
					struct = variable.args;
					variable.invoking = true;
				}
				break;
			}

			// date formatters - YY / yy / ll / HH
			case "formatter": {
				const formatter = FORMATTER_REGEX.exec(capture);

				if (!formatter)
					throw new SyntaxError(`parser@${ptr}: '${capture}' is not a valid formatter. A valid formatter consists of an arbitrary number (including 0) of soft pads (lower case) and hard pads (upper case), in that order`);

				struct.push(mkToken({
					type: "formatter",
					value: capture,
					length: capture.length,
					class: FORMATTER_CLASS_MAP[capture[0].toUpperCase()],
					pad: {
						soft: formatter[1].length,
						hard: formatter[2].length
					}
				}, ex));
				break;
			}

			// selector - [index (boolean, num, function)]{
			case "selector": {
				const selector = mkToken({
						type: "selector",
						parent: struct,
						expr: [],
						terms: [],
						termsMap: {},
						defaultTerm: null,
						coerce: SELECTOR_COERCE_MAP[capture[1]] || "none"
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
			}

			// new selector term {term}
			case "selectorTerm": {
				if (allowedChild) {
					const currentStruct = structStack[structStack.length - 1];

					if (!currentStruct)
						throw new SyntaxError(`parser@${ptr}: Cannot create new selector item: no selector is initialized`);
					if (currentStruct.type != "selector")
						throw new SyntaxError(`parser@${ptr}: Unexpected new selector`);

					const term = {
						label: getCapturingMatch(ex, FORMAT_CAPTURING_GROUPS, "selectorTermLabel") || null,
						term: []
					};
					currentStruct.terms.push(term);
					struct = term.term;
				} else
					struct.push(match);
				break;
			}

			case "fmtRef": {
				struct.push(mkToken({
					type: "fmtRef",
					value: capture
				}, ex));
				break;
			}

			case "terminator": {
				const token = structStack[structStack.length - 1],
					mapItem = token && TERMINATOR_MAP[token.type],
					terminatorMatch = mapItem && (mapItem instanceof RegExp ?
						mapItem.test(capture) :
						mapItem == capture);

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

			case "group": {
				if (allowedChild) {
					const group = mkGroup();

					struct.push(group);
					structStack.push(group);
					group.parent = struct;
					struct = group.children;
				} else
					struct.push(match);
				break;
			}

			case "operator": {
				if (allowedChild) {
					const op = mkToken({
						type: "operator",
						value: capture,
						name: null,
						unary: false
					}, ex);

					if (hasOwn(UNARY_OPS, capture)) {
						op.unary = true;
						op.name = UNARY_OPS[capture];
					}

					if (hasOwn(BINARY_OPS, capture))
						op.name = BINARY_OPS[capture];

					struct.push(op);
				} else
					struct.push(match);
				break;
			}

			case "interpolator": {
				const interpolator = mkToken({
					type: "interpolator",
					parent: struct,
					expr: []
				}, ex);
	
				struct.push(interpolator);
				structStack.push(interpolator);

				struct = interpolator.expr;
				break;
			}

			case "separator": {
				if (allowedChild) {
					const separator = mkToken({
						type: "separator"
					}, ex);

					struct.push(separator);
				} else
					struct.push(match);

				break;
			}

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

	return outStruct;
}

function mkToken(data = {}, ex = null) {
	data.formatToken = true;
	
	if (ex && hasOwn(ex, "index"))
		data.index = ex.index;
	
	return data;
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
	const partition = TOKEN_DATA[tokenType];
	let endStruct = structStack[structStack.length - 1];

	if (partition && partition.ignoreParents) {
		let sIdx = structStack.length;
		while (sIdx > 0 && hasOwn(partition.ignoreParents, structStack[--sIdx].type));
		endStruct = structStack[sIdx];
	}

	if (!partition)
		return false;

	if (!endStruct)
		return !!partition.allowNullParent;

	let allowed = partition.allowedParents ?
		hasOwn(partition.allowedParents, endStruct.type) :
		true;

	allowed = allowed && (partition.disAllowedParents ?
		!hasOwn(partition.disAllowedParents, endStruct.type) :
		true);

	return allowed;
}

function cleanAST(parsed) {
	for (let i = parsed.length - 1; i >= 0; i--) {
		const node = parsed[i];

		cASTJoinStr(parsed, i);

		if (!isToken(node))
			continue;

		if (hasOwn(node, "children"))
			cleanAST(node.children, node, i);
		
		switch (node.type) {
			case "variable":
				node.args = node.children = cASTFormatArgs(node.args);
				break;

			case "selector":
				for (let i = 0, l = node.terms.length; i < l; i++) {
					const term = node.terms[i];
					cleanAST(term);

					if (term.label === null)
						node.defaultTerm = term;
					else {
						if (hasOwn(node.termsMap, term.label))
							throw new SyntaxError(`Invalid selector label: '${term.label}' is already a defined label`);

						node.termsMap[term.label] = term;
					}
				}

				node.terms.forEach(t => cleanAST(t.term));
				cleanAST(node.expr);
				cASTFormatExpr(node.expr);
				cASTAtomizeExpr(node.expr);
				break;

			case "interpolator":
				cleanAST(node.expr);
				cASTFormatExpr(node.expr);
				cASTAtomizeExpr(node.expr);
				break;
		}
	}
}

function cASTJoinStr(parsed, idx) {
	const currNode = parsed[idx],
		nextNode = parsed[idx + 1];

	if (typeof currNode == "string" && typeof nextNode == "string") {
		parsed[idx] = currNode + nextNode;
		parsed.splice(idx + 1, 1);
	}
}

function cASTFormatArgs(tokens) {
	const outArgs = [];
	let expr = [],
		ptr = 0;

	for (let i = 0, l = tokens.length; i <= l; i++) {
		const token = tokens[i];

		if (typeof token == "string" && !token.trim())
			continue;

		if (i == l || isToken(token, "separator", "interpolator")) {
			if (isToken(token, "interpolator"))
				outArgs.push(token);

			if (expr.length) {
				cleanAST(expr);
				cASTFormatExpr(expr);
				cASTAtomizeExpr(expr);

				outArgs[ptr] = mkToken({
					type: "interpolator",
					expr
				});

				expr = [];
			}

			ptr++;
		} else
			expr.push(token);
	}

	return outArgs;
}

function cASTFormatExpr(expr) {
	let nextOpIdx = 1;

	for (let i = 0, l = expr.length; i < l; i++) {
		const item = expr[i],
			isOp = isToken(item, "operator");

		if (isOp) {
			if (!item.unary && i != nextOpIdx) {
				if (hasOwn(UNARY_CONVERTIBLE_OPS, item.value)) {
					item.unary = true;
					item.name = UNARY_CONVERTIBLE_OPS[item.value];
				} else
					throw new SyntaxError("Invalid boolean expression: unexpected binary operator");
			} else {
				if (item.unary && i > 0 && !isToken(expr[i - 1], "operator"))
					throw new SyntaxError("Invalid boolean expression: unexpected unary operator");
				if (i == l - 1)
					throw new SyntaxError("Invalid boolean expression: found terminating operator");
			}
		} else {
			if (i == nextOpIdx)
				throw new SyntaxError("Invalid boolean expression: expected an operator, but got a value");
		}

		if (isOp)
			nextOpIdx += item.unary ? 1 : 2;

		if (isToken(item, "group"))
			cASTFormatExpr(item.children);
		else if (typeof item == "string")
			expr[i] = toLiteral(item, true);
	}
}

// Bundle together AND terms to aid short circuit evaluation,
// and apply operator precedence
// Reason:
// 1	2	 3	  4
// F && F || T && F evaluates 1 - 3 - 4
// F || F && T || F evaluates 1 - 2 - 4
// T || F && T || F only evaluates 1
function cASTAtomizeExpr(expr) {
	let lastNonOpIdx = -1,
		running = false;

	const tryBundle = idx => {
		if (!running || lastNonOpIdx - idx < 2 || (idx == 0 && lastNonOpIdx == expr.length - 1))
			return;

		const items = expr.splice(idx, lastNonOpIdx - idx + 1, 0);	// 0 is a placeholder
		expr[idx] = mkGroup(items);
		
		running = false;		
	};

	// Bundle non-AND/OR and recursively call the atomizer
	for (let i = expr.length - 1; i >= 0; i--) {
		const item = expr[i];

		if (isToken(item, "operator")) {
			if (AND_OR.has(item.value))
				tryBundle(i + 1);
			else
				running = true;
		} else {
			if (isToken(item, "group"))
				cASTAtomizeExpr(item.children);
			if (!running)
				lastNonOpIdx = i;
		}
	}

	tryBundle(0);
	running = false;

	// Bundle all operators in order of precedence
	for (let i = 0, l = OP_PRECEDENCE.length; i < l; i++) {
		const operators = OP_PRECEDENCE[i];

		for (let j = expr.length - 1; j >= 0; j--) {
			const item = expr[j];
	
			if (isToken(item, "operator")) {
				if (!operators.has(item.value) && !item.unary)
					tryBundle(j + 1);
				else
					running = true;
			} else if (!running)
				lastNonOpIdx = j;
		}
	
		tryBundle(0);
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
	if (hasOwn(constantLiterals, str))
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

function resolveFormat(parsedFormat, meta) {
	const store = meta.store;

	// Resolves to a string
	const resolve = parsed => {
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
	};

	// Resolves to any type
	const resolveToken = token => {
		if (!isToken(token))
			return token;

		switch (token.type) {
			case "variable":
				return resolveRef(store, token, meta, resolveArgs(resolveToken, token.args));
			
			case "formatter":
				return padFormatter(getFormatterUnit(store.date, token.class), token);
				
			case "smartRef": {
				const value = resolveRef(store, token, meta);
				if (value === undefined)
					return token.value;
				return value;
			}

			case "fmtRef": {
				// This is used to pass a correct format trace
				// It could be done by calling resolveFormat with an updated
				// meta object, but to save processing we can just change the trace
				// data temporarily.
				const fTrace = meta.formatTrace;

				meta.formatTrace = resolveRefTrace(fTrace, token, meta);
				
				const parsed = parseFormat(meta.formatTrace.data),
					resolved = resolve(parsed);

				meta.formatTrace = fTrace;

				return resolved;
			}

			case "selector": {
				let exprVal = resolveExpr(resolveToken, token.expr),
					term = null;

				switch (token.coerce) {
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

						if (token.coerce == "integer")
							exprVal = Math.floor(exprVal);
				}

				switch (typeof exprVal) {
					case "boolean":
						term = token.terms[+!exprVal];
						break;

					case "number":
						term = token.terms[exprVal];
						break;

					case "string":
						term = token.termsMap[exprVal] || token.defaultTerm;
						break;
				}

				return term ? term.term : "";
			}

			case "interpolator":
				return resolveExpr(resolveToken, token.expr);
		}
	};

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
	const evalTape = _ => {
		const item = expr[idx++];

		if (isToken(item, "group"))
			return resolveExpr(resolveToken, item.children);

		if (!isToken(item, "operator"))
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
			case "+":
				if (item.unary)
					return +evalTape();

				return val + evalTape();
			case "-":
				if (item.unary)
					return -evalTape();

				return val - evalTape();
			case "*": {
				return overload(
					val,
					evalTape(),
					[
						{
							left: "string",
							right: "number",
							run: (l, r) => repeat(l, r)
						},
						{
							left: "any",
							right: "any",
							run: (l, r) => l * r
						}
					]
				);
			}
			case "/":
				return val / evalTape();
			case "//":
				return Math.floor(val / evalTape());
			case "**":
				return Math.pow(val, evalTape());
			case "??":
				if (val == null)
					return evalTape();
				
				idx++;
				return val;
			case "%":
				return val % evalTape();
		}
	};

	let idx = 0,
		sCircOp = null,
		val = evalTape();

	while (idx < expr.length) {
		const nextVal = evalTape();

		if (sCircOp && ((sCircOp == "AND" && !val) || (sCircOp == "OR" && val)))
			return val;

		val = nextVal;
	}

	return val;
}

function overload(left, right, conditions, def) {
	for (let i = 0, l = conditions.length; i < l; i++) {
		const condition = conditions[i],
			lml = matchType(left, condition.left),
			rmr = matchType(right, condition.right);

		if (lml && rmr)
			return condition.run(left, right);

		if (condition.swappable === false)
			continue;

		const lmr = matchType(left, condition.right),
			rml = matchType(right, condition.left);

		if (lmr && rml)
			return condition.run(right, left);
	}

	return def;
}

function resolveRef(store, token, meta, args = []) {
	let item = get(store, token.value, undefined, "context");

	if (typeof item.data == "function" && token.invoking) {
		meta.context = item.context;
		meta.token = token;
		meta.args = args;
		return item.context[item.key](meta, ...args);
	}

	return item.data;
}

function resolveRefCaller(store, token, meta, ...args) {
	let item = get(store, token.value, undefined, "context");

	if (typeof item.data == "function" && token.invoking) {
		meta.context = item.context;
		meta.token = token;
		meta.args = args;
		item.data = item.context[item.key](meta, ...args);
	}

	return item;
}

const isTraceObj = sym("isTraceObj"),
	stepRegex = /^\.*/;

function resolveRefTrace(store, tokenOrPath, meta, args = []) {
	let steps = 0,
		path = isToken(tokenOrPath) ?
			tokenOrPath.value :
			tokenOrPath;

	if (typeof path == "string") {
		steps = stepRegex.exec(path)[0].length;
		path = splitPath(path.substr(steps));
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

	if (meta) {
		meta.context = item.context;
		meta.token = isToken(tokenOrPath) ? tokenOrPath : null;
		meta.args = args;
	}
	item.data = resolveVal(item.data, meta, ...args);
	item.store = store;
	item.path = path;
	item[isTraceObj] = true;

	return item;
}

function isToken(candidate, ...types) {
	if (!candidate || typeof candidate != "object" || !hasOwn(candidate, "formatToken"))
		return false;

	if (!types.length)
		return true;

	for (let i = 0, l = types.length; i < l; i++) {
		const type = types[i];

		if (typeof type == "string" && candidate.type == type)
			return true;
	}

	return false;
}

function queryPermissions(token, action) {
	if (!token || !token.formatToken)
		return false;

	const partition = TOKEN_DATA[token.type];
	
	if (!partition)
		return false;

	return !!partition.permissions[action];
}

function getFormatterUnit(date, cls) {
	if (!(date instanceof Date))
		return 0;

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

	return 0;
}

function padFormatter(num, formatter) {
	num = "" + num;
	const pad = formatter.pad;

	num = Number(num.substr(Math.max(num.length - (pad.hard + pad.soft), 0)));
	return padStart(num, pad.hard, "0");
}

function processFormatter(args, formatter, getter) {
	if (isToken(formatter, "formatter")) {
		let out = getFormatterUnit(args.store.date, formatter.class);

		const outCandidate = typeof getter == "function" ? getter(true, out, formatter) : out;
		if (outCandidate !== undefined)
			out = outCandidate;

		if (typeof out == "number")
			return padFormatter(out, formatter);
		else if (typeof out == "string")
			return out;
		else if (isToken(out, "formatter"))
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
	isToken,
	isToken as isFmt,
	resolveRef,
	resolveRefCaller,
	resolveRefTrace,
	processFormatter,
	passVars
};
