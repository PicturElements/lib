import parseRegex from "./parse-regex";
import mkCharacterSet from "./mk-character-set";

const T = parseRegex.TOKENS;

export default function getRegexMetrics(source, flags = "") {
	const metrics = {
		matchStart: false,
		matchEnd: false,
		peek: null,
		ast: null,
		min: 0,
		max: 0,
		complexity: 0,
		groups: {
			capture: [],
			nonCapture: [],
			positiveLookahead: [],
			negativeLookahead: []
		}
	};
	const sets = {
		peek: {
			positive: "",
			negative: "",
			override: null
		},
		includes: {
			positive: "",
			negative: "",
			override: null
		}
	};

	const extendSets = (res, extension, mode = "set") => {
		let key = "positive";
		if (mode == "set" && extension[0] == "^") {
			key = "negative";
			extension = extension.substring(1);
		} else if (mode == "override")
			key = "override";

		if (mode == "set") {
			if (extension[extension.length - 1] == "-")
				extension = extension.substring(0, extension.length - 1) + "\\-";
		} else
			extension = extension.replace(/-/g, "\\-");

		if (extension[0] == "-" || extension[0] == "^")
			extension = "\\" + extension;

		if (mode == "literal" && res.peek) {
			sets.peek[key] += extension[0] == "\\" ?
				extension.substring(0, 2) :
				extension[0];
		} else if (res.peek)
			sets.peek[key] = (sets.peek[key] || "") + extension;

		sets.includes[key] = (sets.includes[key] || "") + extension;
	};

	const traverse = (n, r) => {
		const nodes = n.children;
		const res = {
			complexity: 1,
			peek: r.peek,
			min: 0,
			max: 0
		};

		for (let i = 0, l = nodes.length; i < l; i++) {
			const node = nodes[i];

			// Group logging
			switch (node.type) {
				case T.GROUP:
					metrics.groups.capture.push(node);
					break;

				case T.NON_CAPTURING_GROUP:
					metrics.groups.nonCapture.push(node);
					break;

				case T.POSITIVE_LOOKAHEAD:
					metrics.groups.positiveLookahead.push(node);
					break;

				case T.NEGATIVE_LOOKAHEAD:
					metrics.groups.negativeLookahead.push(node);
					break;
			}

			// individual nodes
			switch (node.type) {
				case T.START_ASSERTION:
					metrics.matchStart = true;
					break;

				case T.END_ASSERTION:
					metrics.matchEnd = true;
					break;

				case T.SET:
					extendSets(res, node.value);
					break;

				case T.LITERAL:
					extendSets(res, node.value, "literal");
					break;

				case T.ANY:
					extendSets(
						res,
						ast.flagLookup.has("s") ? "" : "\n\r",
						"override"
					);
					break;

				case T.ALTERNATION: {
					let min = Infinity,
						max = 0,
						complexity = 0,
						emptyCount = 0;

					for (let i = 0, l = node.children.length; i < l; i++) {
						const r2 = traverse(node.children[i], res);
						if (!r2.min)
							emptyCount++;
						min = Math.min(min, r2.min);
						max = Math.max(max, r2.max);
						complexity += r2.complexity;
					}

					if (emptyCount > 1)
						complexity -= (emptyCount - 1);

					res.min += min;
					res.max += max;
					res.complexity += complexity - 1;
					break;
				}

				case T.GROUP:
				case T.NON_CAPTURING_GROUP:
				case T.POSITIVE_LOOKAHEAD:
				case T.NEGATIVE_LOOKAHEAD: {
					const r2 = traverse(node, res);

					if (node.quantify) {
						res.min += r2.min * node.quantify.min;
						res.max += r2.max * node.quantify.max;

						if (node.quantify.min)
							res.complexity *= r2.complexity * ((node.quantify.max - node.quantify.min) + 1);
						else {
							// If no repetition is an option, it counts as one case only,
							// but only if the group cannot already form an empty match
							const nullEntry = r2.min ? 1 : 0;
							res.complexity = res.complexity * r2.complexity * (node.quantify.max - node.quantify.min) + nullEntry;
						}
					} else {
						res.min += r2.min;
						res.max += r2.max;
						res.complexity *= r2.complexity;
					}

					if (r2.min)
						res.peek = false;
				}
			}

			// Length and complexity
			switch (node.type) {
				case T.SET:
				case T.LITERAL:
				case T.ANY:
					if (node.quantify) {
						res.min += node.quantify.min;
						res.max += node.quantify.max;
						res.complexity *= (node.quantify.max - node.quantify.min + 1);
					} else {
						const len = node.type == T.LITERAL ? node.value.length : 1;
						res.min += len;
						res.max += len;
					}

					if (!node.quantify || !node.quantify.min)
						res.peek = false;
			}
		}

		return res;
	};

	const ast = parseRegex(source, flags),
		res = traverse(ast, {
			complexity: 1,
			peek: true,
			min: 0,
			max: 0
		});

	metrics.peek = mkCharSet(sets.peek, ast);
	metrics.includes = mkCharSet(sets.includes, ast);
	metrics.trivial = ast.children.length == 1 && ast.children[0].type == T.LITERAL && !ast.children[0].quantify;
	metrics.ast = ast;
	metrics.min = res.min;
	metrics.max = res.max;
	metrics.complexity = res.complexity;
	return metrics;
}

function mkCharSet(set, ast) {
	const insensitive = ast.flagLookup.has("i"),
		pos = set.positive ? mkCharacterSet(set.positive, insensitive) : null,
		neg = set.negative ? mkCharacterSet("^" + set.negative, insensitive) : null,
		oneg = set.override != null ? mkCharacterSet("^" + set.override, insensitive) : null;

	// Verbose for third party clarity
	if (oneg) {
		if (pos && neg)
			return v => oneg(v) || pos(v) || neg(v);
		if (pos)
			return v => oneg(v) || pos(v);
		if (neg)
			return v => oneg(v) || neg(v);
		return oneg;
	} else {
		if (pos && neg)
			return v => pos(v) || neg(v);
		return pos || neg || (_ => false);
	}
}
