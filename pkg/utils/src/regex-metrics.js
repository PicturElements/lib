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
		positive: "",
		negative: "",
		globalNegative: null
	};

	const extendSet = (extension, literal) => {
		let key = "positive";
		if (extension[0] == "^" && !literal) {
			key = "negative";
			extension = extension.substring(1);
		}

		if (extension[extension.length - 1] == "-")
			extension = extension.substring(0, extension.length - 1) + "\\-";

		if (extension[0] == "-" || extension[0] == "^")
			extension = "\\" + extension;

		sets[key] += extension;
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
					if (res.peek)
						extendSet(node.value);
					break;

				case T.LITERAL:
					if (res.peek)
						extendSet(node.value[0], true);
					break;

				case T.ANY:
					if (res.peek)
						sets.globalNegative = ast.flagLookup.has("s") ? "" : "\n\r";
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

	const insensitive = ast.flagLookup.has("i"),
		pos = sets.positive ? mkCharacterSet(sets.positive, insensitive) : null,
		neg = sets.negative ? mkCharacterSet("^" + sets.negative, insensitive) : null,
		gneg = sets.globalNegative ? mkCharacterSet("^" + sets.globalNegative, insensitive) : null;

	// Verbose for third party clarity
	if (gneg) {
		if (pos && neg)
			metrics.peek = v => gneg(v) || pos(v) || neg(v);
		else if (pos)
			metrics.peek = v => gneg(v) || pos(v);
		else if (neg)
			metrics.peek = v => gneg(v) || neg(v);
		else
			metrics.peek = gneg;
	} else {
		if (pos && neg)
			metrics.peek = v => pos(v) || neg(v);
		else
			metrics.peek = pos || neg || (_ => false);
	}

	metrics.ast = ast;
	metrics.min = res.min;
	metrics.max = res.max;
	metrics.complexity = res.complexity;
	return metrics;
}
