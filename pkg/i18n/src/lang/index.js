import {
	get,
	splitPath,
	sym,
	isObj,
	hasOwn,
	lookup,
	repeat,
	unescape,
	filterMut,
	matchType,
	resolveVal,
	isPrimitive
} from "@qtxr/utils";

// NOTE:
// This file heavily utilizes closures to optimize code tersensess
// There is also use of mutable state, especially in parsing and AST cleanup
// Mutations fall into two categories:
// 1. Performance mutations
//    fmtRefs in resolveNode are resolved via temporarily mutating the meta state passed into resolveFormat
//    so that a new meta object doesn't have to be created and all stdlib properties are preserved for further resolving
//    If the responsibilities of this resolver change, seriously consider switching to an immutable implementation
// 2. Mutations on permanently immutable AST
//    These mutations (chiefly in processAST) are intended to clean up data which then is immutable in the resolve stage

// Term handlers describe what actions can be taken on nodes
// under certain circumstances. They are categorized by node type

// argResolvable:	describes whether this node can and should be resolved before being passed
//					as an argument to a function
// exitResolvable	describes whether this term can be resolved at the string joining step
//					of the format resolve, should a term node be passed to the joiner
const NODE_CHARACTERISTICS = {
	// Variables and derivatives
	variable: {
		permissions: {
			argResolvable: true,
			exitResolvable: true
		}
	},
	variableArgs: {
		permissions: {
			argResolvable: true,
			exitResolvable: true
		},
		terminator: ")"
	},
	accessorTerm: {
		allowedParents: {
			variable: true,
			fmtRef: true
		},
		ignoreParents: {
			group: true
		},
		permissions: {
			argResolvable: true,
			exitResolvable: true
		}
	},
	computedAccessorTerm: {
		allowedParents: {
			variable: true,
			fmtRef: true
		},
		ignoreParents: {
			group: true
		},
		permissions: {
			argResolvable: true,
			exitResolvable: true
		},
		terminator: "]"
	},
	fmtRef: {
		permissions: {
			argResolvable: true,
			exitResolvable: true
		},
		terminator: "%"
	},
	// Evaluator derivatives
	selector: {
		permissions: {
			argResolvable: true,
			exitResolvable: true
		},
		terminator: "}"
	},
	arrayLiteralOrSelectorHead: {
		permissions: {
			argResolvable: true,
			exitResolvable: true
		},
		terminator: "]"
	},
	selectorHead: {
		species: "selector",
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
	interpolator: {
		permissions: {
			argResolvable: true,
			exitResolvable: true
		},
		terminator: "}"
	},
	// Literals, low level resolving
	literal: {
		permissions: {
			argResolvable: true,
			exitResolvable: true
		}
	},
	arrayLiteral: {
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
	customGrammar: {
		permissions: {
			argResolvable: false,
			exitResolvable: true
		}
	},
	// Arithmetic
	operator: {
		allowedParents: {
			variable: true,
			variableArgs: true,
			selectorHead: true,
			arrayLiteral: true,
			arrayLiteralOrSelectorHead: true,
			interpolator: true,
			computedAccessorTerm: true
		},
		ignoreParents: {
			group: true
		},
		permissions: {
			argResolvable: true,
			exitResolvable: true
		}
	},
	// Structure
	group: {
		allowedParents: {
			variable: true,
			variableArgs: true,
			selectorHead: true,
			arrayLiteral: true,
			arrayLiteralOrSelectorHead: true,
			group: true,
			interpolator: true
		},
		permissions: {
			argResolvable: true,
			exitResolvable: true
		},
		terminator: ")"
	},
	separator: {
		allowedParents: {
			variableArgs: true,
			arrayLiteral: true,
			arrayLiteralOrSelectorHead: true
		},
		permissions: {}
	},
	// Abstract
	nonArgsResolvable: {
		ignoreParents: {
			group: true,
			arrayLiteral: true
		}
	}
};

const COERCE_MAP = {
	b: "boolean",
	n: "number",
	i: "integer",
	s: "string"
};

const UNARY_OPS = {
	"!": "NOT",
	"~": "bitwise NOT"
};

const UNARY_CONVERTIBLE_OPS = {
	"+": "casting",
	"-": "inversion"
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

const OP_PRECEDENCE = [
	lookup("&&"),
	lookup("||"),
	lookup("**"),
	lookup(["*", "/", "//", "%"]),
	lookup(["+", "-"]),
	lookup(["<", ">", "<<", ">>", ">>>", ">=", "<=", "==", "===", "!=", "!=="]),
	lookup(["^", "&", "|"]),
	lookup("??")
];

// Because regexes store their last index when the global flag is enabled, trying to use them in
// recursive functions may cause problems. Regex literals in inner scopes will carry a slightly
// bigger overhead than outer scope regexes, but engines can optimize the parsing of the literal
// so that there's no significant performance difference
// 
// const formatRegex = /.../gi; To see the full regex, check parse
const FORMAT_CAPTURING_GROUPS = [
	"comment",
	"literal",					// Literal string, which may contain custom grammars
	null,						// CG2 is a string matcher group and is not used
	"evaluator",				// Evaluator (basis for selectors, computed accessor terms, and interpolators)
	"evaluatorCoercion",		// Evaluator coercion tags
	"evaluatorSpecies",			// Evaluator species ("[" for selector / computed accessor term, "#{" / "${" for interpolator)
	"selectorTerm",				// New selector term
	"precedingSelectorToken",	// Identifies the preceding selector node ("]" for selector head, "}" for selector term)
	"selectorTermLabel",		// Label to assign to selector term (@lbl:)
	"opener",					// Opener (format reference, variable, group, interpolator)
	"steps",					// Steps to go up in ref trace
	"terminator",				// Terminator (format reference, group, interpolator, selector term, selector head)
	"operator",					// Operator (boolean, bitwise, arithmetic)
	"separator"					// Separates parameter nodes
];
const FORMAT_CACHE = {};

function parseFormat(format, parseMeta = {}) {
	if (format == null || !isPrimitive(format))
		return [];

	const cachedFormatKey = typeof parseMeta.cacheKey == "string" ?
		`@cache:${parseMeta.cacheKey}///${format}` :
		format;

	if (hasOwn(FORMAT_CACHE, cachedFormatKey))
		return FORMAT_CACHE[cachedFormatKey];

	const parsed = parse(String(format));
	processAST(parsed, parseMeta);

	FORMAT_CACHE[cachedFormatKey] = parsed;
	return parsed;
}
 
// Create AST-like object by combining the lexing and parsing steps
// Additional processing will be done by processAST, most notably constructing
// and verifying expressions, arguments, literals, and accessors
function parse(format, currentStack) {
	const formatRegex = /(\/\*(?:.|\s)*?\*\/)|((?:[^\\\s(){}[\]$%#@"'`,<>&|!?~^+\-\/*=]|\\[#$]{|\\.)+)|(["'`])(?:\\.|.)*?\3|((?:@([bnis]))?(\[|#{|\${))|((]|})\s*{(?:@((?:[a-z0-9_[\].-]|\\.)+):\s?)?)|([%$(])(\.*)|([)}\]])|(?:(\|\|?|&&?|={2,3}|!==?|>>>?|<<|[<>]=?|[!~^]|[+-]|\*{1,2}|\/{1,2}|\?{2}|%))|(,)/gi,
		outStruct = [],
		structStack = currentStack || [],
		stackLen = structStack.length;
	let struct = outStruct,
		ex = null,
		ptr = 0;

	const push = (node, exOrIndex = ex) => {
		if (typeof node == "string") {
			const lastNode = struct[struct.length - 1];

			if (isNode(lastNode, "literal")) {
				lastNode.value += node;
				lastNode.literal += node;
				return;
			}

			node = mkLiteral(node, exOrIndex);
		}

		runAutoPop(node.type, node);
		struct.push(node);
	};

	const pushStruct = (...nodes) => {
		let len = nodes.length,
			useTrigger = false;
		const popTrigger = nodes[len - 1];

		if (typeof popTrigger == "function") {
			len--;
			useTrigger = true;
		}

		for (let i = 0; i < len; i++) {
			const node = nodes[i];
			node.parent = struct;

			if (useTrigger) {
				node.tryPop = (type, value) => {
					const shouldPop = popTrigger(type, value, node);

					if (shouldPop) {
						popStruct(node, true);
						delete node.tryPop;
						return true;
					}

					return false;
				};
			}

			structStack.push(node);
		}
	};

	const popStruct = (node, usePtrBoundary = false) => {
		const { capture } = getCapturingData(ex);

		if (usePtrBoundary)
			node.literal = format.substr(node.index, ptr - node.index);
		else
			node.literal = format.substr(node.index, ex.index + capture.length - node.index);

		structStack.pop();
		struct = node.parent;
		delete node.tryPop;
		delete node.parent;
	};

	const runAutoPop = (type, value) => {
		const currentStruct = structStack[structStack.length - 1];

		if (currentStruct && typeof currentStruct.tryPop == "function")
			return currentStruct.tryPop(type, value);

		return false;
	};

	while (true) {
		const nextEx = formatRegex.exec(format);
		if (!nextEx)
			break;

		ex = nextEx;

		if (ex.index > ptr) {
			push(format.substr(ptr, ex.index - ptr), ptr);
			ptr = ex.index;
		}

		const { label, capture } = getCapturingData(ex),
			match = ex[0];

		switch (label) {
			// comment - /*comment*/
			case "comment":
				break;

			case "literal": {
				const variable = getParentNodeByType("variable", "accessorTerm", structStack),
					fmtRef = getParentNodeByType("fmtRef", "accessorTerm", structStack);

				if (variable && !variable.builtAccessor || fmtRef) {
					const term = mkNode({
						type: "accessorTerm",
						value: capture,
						literal: capture
					}, ex);

					push(term);
				} else
					push(capture);

				break;
			}

			// selector - [expression]{term}{term2}...{termN}
			// interpolator - #{expression} / ${expression}
			case "evaluator": {
				const evaluatorSpecies = getCapturingMatch(ex, "evaluatorSpecies"),
					coercion = getCapturingMatch(ex, "evaluatorCoercion");

				if (evaluatorSpecies == "#{" || evaluatorSpecies == "${") {
					if (!isAllowedChildNode("interpolator", structStack)) {
						push(match);
						break;
					}

					const interpolator = mkNode({
						type: "interpolator",
						parent: struct,
						expr: [],
						coerce: COERCE_MAP[coercion] || "none"
					}, ex);

					push(interpolator);
					pushStruct(interpolator);
					struct = interpolator.expr;
				} else if (isAllowedChildNode("computedAccessorTerm", structStack)) {
					const computedAccessorTerm = mkNode({
						type: "computedAccessorTerm",
						expr: []
					}, ex);

					computedAccessorTerm.value = computedAccessorTerm.expr;

					push(computedAccessorTerm);
					pushStruct(computedAccessorTerm);
					struct = computedAccessorTerm.expr;
				} else if (coercion) {
					const selector = mkNode({
							type: "selector",
							expr: [],
							terms: [],
							termsMap: {},
							defaultTerm: null,
							coerce: COERCE_MAP[capture[1]] || "none"
						}, ex),
						selectorHead = mkNode({
							type: "selectorHead",
							selector
						});

					push(selector);
					pushStruct(selector, selectorHead);
					struct = selector.expr;
				} else {
					const alsh = mkNode({
						type: "arrayLiteralOrSelectorHead",
						value: [],
						length: 1
					}, ex);

					push(alsh);
					pushStruct(alsh);
					struct = alsh.value;
				}

				break;
			}

			// new selector term {term}
			case "selectorTerm": {
				const alsh = getParentNodeByType("arrayLiteralOrSelectorHead", structStack);

				if (alsh) {
					alsh.type = "selector";
					
					if (alsh.length > 1)
						throwSyntaxError(alsh, "Selector term may not contain multiple expressions");

					alsh.expr = alsh.value;
					alsh.terms = [];
					alsh.termsMap = {};
					alsh.defaultTerm = null;
					delete alsh.value;
				} else if (getCapturingMatch(ex, "precedingSelectorToken") == "]") {
					runAutoPop("selectorTerm", capture);
					const head = getParentNodeByType("selectorHead", structStack);

					if (!head) {
						push(match);
						break;
					}

					popStruct(head);
				}

				if (!isAllowedChildNode("selectorTerm", structStack)) {
					push(match);
					break;
				}

				const selector = getParentNodeByType("selector", "selectorTerm", structStack),
					term = mkNode({
						type: "selectorTerm",
						label: getCapturingMatch(ex, "selectorTermLabel") || null,
						term: []
					}, ex);

				if (!selector)
					throwSyntaxError(term, "Cannot create new selector item: no selector is initialized");

				selector.terms.push(term);
				struct = term.term;
				break;
			}

			case "opener":
				let validOpener = true;

				switch (capture) {
					case "%": {
						if (!isAllowedChildNode("fmtRef", structStack)) {
							push(match);
							break;
						}

						if (isNode(structStack[structStack.length - 1], "fmtRef")) {
							validOpener = false;
							break;
						}

						const fmtRef = mkNode({
							type: "fmtRef",
							accessor: [],
							staticAccessor: true,
							steps: getCapturingMatch(ex, "steps").length
						}, ex);

						push(fmtRef);
						pushStruct(fmtRef);
						struct = fmtRef.accessor;
						break;
					}

					case "$": {
						if (!isAllowedChildNode("variable", structStack)) {
							push(match);
							break;
						}

						const variable = mkNode({
							type: "variable",
							accessor: [],
							args: [],
							invoking: false,
							builtAccessor: false,
							staticAccessor: true
						}, ex);

						// Aliases
						push(variable);
						pushStruct(
							variable,
							type => !(type == "accessorTerm" || type == "computedAccessorTerm" || type == "group")
						);
						struct = variable.accessor;
						break;
					}

					case "(": {
						if (!isAllowedChildNode("group", structStack)) {
							push(match);
							break;
						}

						const variable = getParentNodeByType("variable", structStack);
						if (variable && variable.accessor.length) {
							popStruct(variable);
							pushStruct(mkNode("variableArgs", ex));
							variable.builtAccessor = true;
							variable.invoking = true;
							struct = variable.args;
							break;
						}

						const group = mkGroup(null, ex);

						push(group);
						pushStruct(group);
						struct = group.children;
						break;
					}
				}

				if (validOpener)
					break;
				/* falls through */

			// Terminators must come after openers, as some openers are identical
			// to terminators and will fall through the above case block
			case "terminator": {
				runAutoPop("terminator", capture);

				const node = structStack[structStack.length - 1],
					terminator = get(NODE_CHARACTERISTICS, [node && node.type, "terminator"]),
					terminatorMatch = terminator instanceof RegExp ?
						terminator.test(capture) :
						terminator == capture;

				if (isNode(node, "arrayLiteralOrSelectorHead"))
					node.type = "arrayLiteral";

				// Pop the current struct off the stack, unless the current stack item
				// isn't of the correct type, in which case treat terminator as a character.
				if (terminatorMatch)
					popStruct(node);
				else
					push(capture);

				break;
			}

			case "operator": {
				if (!isAllowedChildNode("operator", structStack)) {
					push(match);
					break;
				}

				const op = mkNode({
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

				push(op);
				break;
			}

			case "separator": {
				runAutoPop("separator", capture);

				if (!isAllowedChildNode("separator", structStack)) {
					push(match);
					break;
				}

				const alsh = getParentNodeByType("arrayLiteralOrSelectorHead", structStack);
				if (alsh)
					alsh.length++;
				
				push(mkNode("separator", ex));

				break;
			}

			default:
				push(match);
		}

		ptr += match.length;
	}

	if (ptr < format.length)
		push(format.substr(ptr, format.length - ptr), ptr);

	runAutoPop("literal", mkLiteral(""));

	const currentStruct = structStack[structStack.length - 1];

	if (structStack.length > stackLen)
		throwSyntaxError(currentStruct, `Invalid format '${format}': unterminated ${currentStruct.type}`);
	if (structStack.length < stackLen)
		throwSyntaxError(currentStruct, `Invalid format '${format}': unexpected ${currentStruct.type}`);

	return outStruct;
}

function mkNode(data = {}, exOrIndex = null) {
	if (typeof data == "string") {
		data = {
			type: data
		};
	}

	if (typeof exOrIndex == "number")
		data.index = exOrIndex;
	else if (exOrIndex && hasOwn(exOrIndex, "index")) {
		data.index = exOrIndex.index;

		if (!hasOwn(data, "literal"))
			data.literal = exOrIndex[0];
	}

	data.isNode = true;
	return data;
}

function mkLiteral(value, exOrIndex = null) {
	return mkNode({
		type: "literal",
		value: unescape(value),
		literal: value,
		defaultToSmartRef: true
	}, exOrIndex);
}

function mkGroup(children, exOrIndex = null) {
	return mkNode({
		type: "group",
		children: children || []
	}, exOrIndex);
}

function getCapturingData(ex, labels = FORMAT_CAPTURING_GROUPS) {
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

function getCapturingMatch(ex, label, labels = FORMAT_CAPTURING_GROUPS) {
	const idx = labels.indexOf(label);
	if (idx < 0)
		return undefined;

	return ex[idx + 1];
}

function isAllowedChildNode(childNodeType, structStack) {
	const partition = NODE_CHARACTERISTICS[childNodeType],
		parentNode = getParentNode(childNodeType, structStack),
		parentType = (parentNode && parentNode.type) || "root";

	if (!partition)
		return false;

	let allowed = partition.allowedParents ?
		hasOwn(partition.allowedParents, parentType) :
		true;

	allowed = allowed && (partition.disAllowedParents ?
		!hasOwn(partition.disAllowedParents, parentType) :
		true);

	if (!allowed && parentType == "root" && partition.allowRoot)
		return true;

	return allowed;
}

function getParentNode(childNodeType, structStack) {
	if (typeof childNodeType != "string") {
		if (Array.isArray(childNodeType))
			structStack = childNodeType;

		childNodeType = null;
	}

	const partition = childNodeType && NODE_CHARACTERISTICS[childNodeType];

	if (partition && partition.ignoreParents && structStack.length) {
		let sIdx = structStack.length;

		while (sIdx > 0 && hasOwn(partition.ignoreParents, structStack[--sIdx].type));

		return hasOwn(partition.ignoreParents, structStack[sIdx].type) ?
			null :
			structStack[sIdx];
	}

	return structStack[structStack.length - 1] || null;
}

function getParentNodeByType(parentNodeType, childNodeType, structStack) {
	if (typeof childNodeType != "string") {
		structStack = childNodeType;
		childNodeType = null;
	}

	const parentNode = getParentNode(childNodeType, structStack);

	if (parentNode && parentNode.type == parentNodeType)
		return parentNode;

	return null;
}

function hasParentNodeByType(parentNodeType, childNodeType, structStack) {
	return Boolean(
		getParentNodeByType(parentNodeType, childNodeType, structStack)
	);
}

function processAST(nodes, parseMeta = {}) {
	parseMeta.stack = parseMeta.stack || [];
	const stack = parseMeta.stack;

	pASTResolveFormats(nodes, parseMeta);

	for (let i = 0, l = nodes.length; i < l; i++) {
		const node = nodes[i];
		node.resolvable = hasPermission(node, "argResolvable") || !hasParentNodeByType("variable", "nonArgsResolvable", stack);
		stack.push(node);

		if (hasOwn(node, "children"))
			processAST(node.children, parseMeta);

		switch (node.type) {
			case "variable":
				pASTStripWhitespace(node.args);
				node.args = pASTFormatArray(node.args, parseMeta);
				node.accessor = pASTCleanAccessor(node, parseMeta);
				break;

			case "arrayLiteral":
				pASTStripWhitespace(node.value);
				node.value = pASTFormatArray(node.value, parseMeta);
				break;

			case "fmtRef":
				pASTStripWhitespace(node.accessor);
				node.accessor = pASTCleanAccessor(node, parseMeta);
				break;

			case "selector":
				for (let i = 0, l = node.terms.length; i < l; i++) {
					const term = node.terms[i];
					processAST(term, parseMeta);

					if (term.label === null)
						node.defaultTerm = term;
					else {
						if (hasOwn(node.termsMap, term.label))
							throwSyntaxError(term, `Invalid selector label: '${term.label}' is already a defined label`);

						node.termsMap[term.label] = term;
					}
				}

				node.terms.forEach(t => processAST(t.term, parseMeta));
				pASTFormatExpr(node.expr, parseMeta);
				break;

			case "interpolator":
				pASTFormatExpr(node.expr, parseMeta);
				break;
		}

		stack.pop(node);
	}
}

function pASTStripWhitespace(nodes) {
	filterMut(nodes, node => {
		if (isNode(node, "literal")) {
			let stripped = node.value.replace(/^\s+/, "");
			node.index += (node.value.length - stripped.length);
			stripped = stripped.trim();

			if (!stripped)
				return false;

			node.value = stripped;
			node.literal = stripped;
		} else if (isNode(node, "group"))
			pASTStripWhitespace(node.children);

		return true;
	});
}

function pASTResolveFormats(nodes, parseMeta = {}) {
	const grammars = parseMeta.customGrammars;

	if (!Array.isArray(grammars))
		return;

	const replaceNode = (nde, grammar) => {
		const regex = grammar.regex,
			newNodes = [nde],
			str = nde.value;
		let offset = 0;

		regex.lastIndex = 0;

		if (!(regex instanceof RegExp))
			throw new TypeError("Cannot resolve format: no regex defined");

		while (true) {
			const ex = regex.exec(str);
			if (!ex)
				break;

			const match = ex[0],
				newNode = mkNode(Object.assign({}, grammar, {
					type: "customGrammar",
					source: grammar,
					literal: match,
					index: nde.index + ex.index
				}));

			if (typeof grammar.parse == "function") {
				const nodeData = grammar.parse({
					ex,
					str,
					match,
					literalNode: nde,
					throwSyntaxError: msg => throwSyntaxError(newNode, msg)
				}, newNode, parseMeta);

				if (nodeData)
					Object.assign(newNode, nodeData);
				else
					continue;
			}

			const lastNode = newNodes[newNodes.length - 1],
				nodeVal = lastNode.value,
				idx = ex.index - offset;

			if (idx == 0)
				newNodes[newNodes.length - 1] = newNode;
			else {
				lastNode.value = nodeVal.substr(0, idx);
				lastNode.literal = lastNode.value;
				newNodes.push(newNode);
			}

			if (idx + match.length < nodeVal.length) {
				newNodes.push(mkLiteral(
					nodeVal.substr(idx + match.length),
					nde.index + idx + match.length
				));
			} else
				return newNodes;

			if (!regex.global)
				break;

			offset = (ex.index + match.length);
		}

		return newNodes;
	};

	const replaceNodes = (nds, grammar) => {
		for (let i = nds.length - 1; i >= 0; i--) {
			if (!isNode(nds[i], "literal"))
				continue;

			nds.splice(i, 1, ...replaceNode(nds[i], grammar));
		}
	};

	for (let i = nodes.length - 1; i >= 0; i--) {
		const node = nodes[i];

		if (!isNode(node, "literal"))
			continue;

		const newNodes = [node];

		for (let j = 0, l2 = grammars.length; j < l2; j++)
			replaceNodes(newNodes, grammars[j]);

		nodes.splice(i, 1, ...newNodes);
	}	
}

function pASTFormatArray(nodes, parseMeta = {}) {
	const out = [];
	let expr = [],
		ptr = 0;

	for (let i = 0, l = nodes.length; i <= l; i++) {
		const node = nodes[i];

		if (i == l || isNode(node, "separator", "interpolator")) {
			if (isNode(node, "interpolator"))
				out.push(node);

			if (expr.length) {
				pASTFormatExpr(expr, parseMeta);

				out[ptr] = expr.length == 1 ?
					expr[0] :
					mkNode({
						type: "interpolator",
						expr
					});

				expr = [];
			}

			ptr++;
		} else
			expr.push(node);
	}

	return out;
}

function pASTCleanAccessor(node, parseMeta = {}) {
	const accessor = flattenGroups(node.accessor),
		cleanAccessor = [];

	for (let i = 0, l = accessor.length; i < l; i++) {
		const term = accessor[i];

		switch (term.type) {
			case "accessorTerm":
				const split = splitPath(term.value);

				for (let i = 0, l = split.length; i < l; i++)
					cleanAccessor.push(split[i]);
				break;

			case "computedAccessorTerm":
				pASTFormatExpr(term.expr, parseMeta);

				if (term.expr.length == 1 && isPrimitive(term.expr[0]))
					cleanAccessor.push(term.expr[0]);
				else {
					node.staticAccessor = false;
					cleanAccessor.push(term);
				}

				break;

			default:
				throwSyntaxError(term, `Unexpected ${term.type} node in accessor`);
		}
	}

	return cleanAccessor;
}

function pASTFormatExpr(expr, parseMeta = {}) {
	processAST(expr, parseMeta);
	pASTStripWhitespace(expr);
	pASTCleanExpr(expr);
	pASTAtomizeExpr(expr);
}

function pASTCleanExpr(expr) {
	let nextOpIdx = 1;

	for (let i = 0; i < expr.length; i++) {
		let node = expr[i];
		const isOp = isNode(node, "operator");

		if (isOp) {
			if (!node.unary && i != nextOpIdx) {
				if (hasOwn(UNARY_CONVERTIBLE_OPS, node.value)) {
					node.unary = true;
					node.name = UNARY_CONVERTIBLE_OPS[node.value];
				} else
					throwSyntaxError(node, "Invalid boolean expression: unexpected binary operator");
			} else {
				if (node.unary && i > 0 && !isNode(expr[i - 1], "operator"))
					throwSyntaxError(node, "Invalid boolean expression: unexpected unary operator");
				if (i == expr.length - 1)
					throwSyntaxError(node, "Invalid boolean expression: found terminating operator");
			}
		} else if (i == nextOpIdx)
			throwSyntaxError(node, "Invalid boolean expression: expected an operator, but got a value");

		if (isOp)
			nextOpIdx += node.unary ? 1 : 2;

		if (isNode(node, "group"))
			pASTCleanExpr(node.children);
		else if (isNode(node, "literal"))
			transformLiteral(node);
	}
}

// Bundle together AND terms to aid short circuit evaluation,
// and apply operator precedence
// Reason:
// 1	2	 3	  4
// F && F || T && F evaluates 1 - 3 - 4
// F || F && T || F evaluates 1 - 2 - 4
// T || F && T || F only evaluates 1
function pASTAtomizeExpr(expr) {
	// Recursively call the atomizer
	for (let i = expr.length - 1; i >= 0; i--) {
		if (isNode(expr[i], "group"))
			pASTAtomizeExpr(expr[i].children);
	}

	const tryBundle = idx => {
		if (!running || lastNonOpIdx - idx < 2 || (idx == 0 && lastNonOpIdx == expr.length - 1))
			return;

		const items = expr.splice(idx, lastNonOpIdx - idx + 1, 0);	// 0 is a placeholder
		expr[idx] = mkGroup(items);

		running = false;
	};

	let lastNonOpIdx = -1,
		running = false;

	// Bundle all operators in order of precedence
	for (let i = 0, l = OP_PRECEDENCE.length; i < l; i++) {
		const operators = OP_PRECEDENCE[i];

		for (let j = expr.length - 1; j >= 0; j--) {
			const item = expr[j];

			if (isNode(item, "operator")) {
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
		NaN: NaN,
		Infinity: Infinity,
		undefined: undefined,
		null: null
	};

function transformLiteral(node) {
	const value = node.value,
		ex = stringMatchRegex.exec(value);

	if (ex)
		node.value = ex[2];
	else if (hasOwn(constantLiterals, value))
		node.value = constantLiterals[value];
	else if (!isNaN(Number(value)))
		node.value = Number(value);
	// If the defaultToSmartRef flag is truthy, return a format
	// term that can be resolved to a value, or fall back as a string.
	// This form is used in function invocations where ideally strings should be quoted
	// but where it may be useful to refer to variables without the $ syntax
	// or use strings without quotes for legibility
	else if (node.defaultToSmartRef) {
		node.type = "smartRef";
		delete node.defaultToSmartRef;
	}

	return node;
}

function flattenGroups(arr, depth = Infinity, out = []) {
	for (let i = 0, l = arr.length; i < l; i++) {
		const item = arr[i];

		if (depth > 0 && isNode(item, "group"))
			flattenGroups(item.children, depth - 1, out);
		else
			out.push(item);
	}

	return out;
}

function throwSyntaxError(node, msg) {
	let e;
 
	if (typeof node.index == "number")
		e = new SyntaxError(`\n\nparser@${node.type} (at ${node.index + 1})\n${msg}\n------`);
	else
		e = new SyntaxError(`\n\nparser@[unknown]\n${msg}\n------`);

	// Clean up printed stack trace (Chromium)
	e.stack = e.stack.replace(/------(?:.|\n)+/, "");
	throw e;
}

function resolveFormat(parsedFormat, meta = {}) {
	const store = meta.store;

	// Resolves to a string, unless the singular flag is set
	const resolve = (nodes, singular = false) => {
		if (singular)
			nodes = [nodes];

		if (nodes == null)
			return "";

		let out = [];

		for (let i = 0, l = nodes.length; i < l; i++) {
			let resolved = resolveNode(nodes[i]);

			if (resolved == null)
				continue;

			// If a raw format item has made its way through, resolve it again.
			if (hasPermission(resolved, "exitResolvable"))
				resolved = resolveNode(resolved);
			if (Array.isArray(resolved))
				resolved = resolve(resolved);

			if (singular)
				return resolved;

			out.push(resolved);
		}

		return out.join("");
	};

	// Resolves to any type
	const resolveNode = node => {
		if (!node.resolvable)
			return node;

		switch (node.type) {
			case "literal":
				return node.value;

			case "arrayLiteral":
				return resolveArray(node.value, resolveNode, meta);

			case "variable":
				return resolveRef(store, node, meta, resolveArray(node.args, resolveNode, meta));

			case "interpolator":
				return resolveCoerceExpr(node, resolveNode);

			case "computedAccessorTerm":
				return resolveExpr(node.expr, resolveNode);

			case "customGrammar":
				return node.resolve(meta, node);

			case "smartRef": {
				const value = resolveRef(store, node, meta);
				if (value === undefined)
					return node.value;

				return value;
			}

			case "fmtRef": {
				// This is used to pass a correct format trace
				// It could be done by calling resolveFormat with an updated
				// meta object, but to save processing we can just change the trace
				// data temporarily
				const fTrace = meta.formatTrace;

				meta.formatTrace = resolveRefTrace(fTrace, node, meta);

				const parsed = parseFormat(meta.formatTrace.data),
					resolved = resolve(parsed);

				meta.formatTrace = fTrace;

				return resolved;
			}

			case "selector": {
				const exprVal = resolveCoerceExpr(node, resolveNode);
				let term = null;

				switch (typeof exprVal) {
					case "boolean":
						term = node.terms[+!exprVal];
						break;

					case "number":
						term = node.terms[exprVal];
						break;

					case "string":
						term = node.termsMap[exprVal] || node.defaultTerm;
						break;
				}

				return term ?
					resolveFormat(term.term, meta) :
					"";
			}
		}
	};

	return resolve(parsedFormat, parsedFormat.isNode);
}

function resolveArray(arr, resolver = resolveFormat, meta = {}) {
	const out = [];

	for (let i = 0, l = arr.length; i < l; i++) {
		if (arr[i])
			out[i] = resolver(arr[i], meta);
	}

	return out;
}

function resolveCoerceExpr(node, resolver = resolveFormat, meta = {}) {
	const resolved = resolveExpr(node.expr, resolver, meta);

	switch (node.coerce) {
		case "boolean":
			return Boolean(resolved);

		case "string":
			return String(resolved);

		case "number":
		case "integer": {
			let num = Number(resolved);

			if (isNaN(num))
				num = -1;

			return node.coerce == "integer" ?
				~~num :
				num;
		}
	}

	return resolved;
}

function resolveExpr(expr, resolver = resolveFormat, meta = {}) {
	const rt = {
		idx: 0,
		sCircOp: null,
		val: null,
		expr,
		resolver,
		meta
	};

	const len = expr.length;
	rt.val = evalTape(rt);

	while (rt.idx < len) {
		const nextVal = evalTape(rt);

		if (rt.sCircOp && ((rt.sCircOp == "AND" && !rt.val) || (rt.sCircOp == "OR" && rt.val)))
			return rt.val;

		rt.val = nextVal;
	}

	return rt.val;
}

function evalTape(rt) {
	const term = rt.expr[rt.idx++];

	if (term.type == "group")
		return resolveExpr(term.children, rt.resolver);

	if (term.type != "operator")
		return rt.resolver(term, rt.meta);

	switch (term.value) {
		case "!":
			return !evalTape(rt);
		case "~":
			return ~evalTape(rt);
		case "|":
			return rt.val | evalTape(rt);
		case "||":
			rt.sCircOp = "OR";
			return rt.val || evalTape(rt);
		case "&":
			return rt.val & evalTape(rt);
		case "&&":
			rt.sCircOp = "AND";
			return rt.val && evalTape(rt);
		case "^":
			return rt.val ^ evalTape(rt);
		case ">":
			return rt.val > evalTape(rt);
		case "<":
			return rt.val < evalTape(rt);
		case "==":
			return rt.val == evalTape(rt);
		case "===":
			return rt.val === evalTape(rt);
		case "!=":
			return rt.val != evalTape(rt);
		case "!==":
			return rt.val !== evalTape(rt);
		case ">=":
			return rt.val >= evalTape(rt);
		case "<=":
			return rt.val <= evalTape(rt);
		case "<<":
			return rt.val << evalTape(rt);
		case ">>":
			return rt.val >> evalTape(rt);
		case ">>>":
			return rt.val >>> evalTape(rt);
		case "+":
			if (term.unary)
				return +evalTape(rt);

			return rt.val + evalTape(rt);
		case "-":
			if (term.unary)
				return -evalTape(rt);

			return rt.val - evalTape(rt);
		case "*": {
			return overload(
				rt.val,
				evalTape(rt),
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
			return rt.val / evalTape(rt);
		case "//":
			return Math.floor(rt.val / evalTape(rt));
		case "**":
			return Math.pow(rt.val, evalTape(rt));
		case "??":
			if (rt.val == null)
				return evalTape(rt);

			rt.idx++;
			return rt.val;
		case "%":
			return rt.val % evalTape(rt);
	}
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

function resolveRef(store, node, meta, args = []) {
	let item = resolveGet(store, node, meta);

	if (typeof item.data == "function" && node.invoking) {
		meta.context = item.context;
		meta.node = node;
		meta.args = args;
		return item.context[item.key](meta, ...args);
	}

	return item.data;
}

function resolveRefCaller(store, node, meta, ...args) {
	let item = resolveGet(store, node, meta);

	if (typeof item.data == "function" && node.invoking) {
		meta.context = item.context;
		meta.node = node;
		meta.args = args;
		item.data = item.context[item.key](meta, ...args);
	}

	return item;
}

function resolveGet(store, node, meta) {
	if (node.type != "variable")
		return get(store, node.value, undefined, "context");

	if (node.staticAccessor)
		return get(store, node.accessor, undefined, "context");

	return get(store, node.accessor, undefined, {
		context: true,
		resolveKey: term => {
			if (isPrimitive(term))
				return term;

			return resolveFormat(term, meta);
		}
	});
}

const isTraceObj = sym("isTraceObj"),
	stepRegex = /^\.*/;

function resolveRefTrace(store, nodeOrPath, meta, args = []) {
	let steps = 0,
		path = nodeOrPath;

	if (isNode(nodeOrPath)) {
		steps = nodeOrPath.steps;
		path = nodeOrPath.accessor;
	}

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
		meta.node = isNode(nodeOrPath) ? nodeOrPath : null;
		meta.args = args;
	}
	item.data = resolveVal(item.data, meta, ...args);
	item.store = store;
	item.path = path;
	item[isTraceObj] = true;

	return item;
}

function isNode(candidate, ...types) {
	if (!candidate || typeof candidate != "object" || !hasOwn(candidate, "isNode"))
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

function isGrammarNode(candidate, ...types) {
	if (!isNode(candidate, "customGrammar"))
		return false;

	if (!types.length)
		return true;

	for (let i = 0, l = types.length; i < l; i++) {
		const type = types[i];

		if (typeof type == "string" && candidate.name == type)
			return true;
	}

	return false;
}

function hasPermission(node, action) {
	if (!node || !node.isNode)
		return false;

	const characteristics = NODE_CHARACTERISTICS[node.type];

	if (!characteristics)
		return false;

	return !!characteristics.permissions[action];
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
	isNode,
	isNode as isFmt,
	isGrammarNode,
	resolveRef,
	resolveRefCaller,
	resolveRefTrace,
	passVars
};
