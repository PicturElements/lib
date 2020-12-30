import { assign } from "./object";
import { getRegexSource } from "./regex";

// Exregex (extended regular expression, or xrx) is a superset to regular expressions, chiefly concerned
// with efficient application of recursive regular expression constructs. Xrxs operate on strings in
// a way that differs slightly from ordinary regular expressions. Fundamentally, xrxs extract grammars
// in a lazy fashion, extracting minimal length strings that match the input, and preserve context
// to efficiently and cleanly nest expressions.

const T = {
	NONTERMINAL: "NONTERMINAL",
	CAPTURING_GROUP: "CAPTURING_GROUP",
	NON_CAPTURING_GROUP: "NON_CAPTURING_GROUP",
	POSITIVE_LOOKAHEAD: "POSITIVE_LOOKAHEAD",
	NEGATIVE_LOOKAHEAD: "NEGATIVE_LOOKAHEAD",
	POSITIVE_LOOKBEHIND: "POSITIVE_LOOKBEHIND",
	NEGATIVE_LOOKBEHIND: "NEGATIVE_LOOKBEHIND"
};

const GROUP_SIGNATURES = {
	"?:": T.NON_CAPTURING_GROUP,
	"?=": T.POSITIVE_LOOKAHEAD,
	"?!": T.NEGATIVE_LOOKAHEAD,
	"?<=": T.POSITIVE_LOOKBEHIND,
	"?<!": T.NEGATIVE_LOOKBEHIND
};

export default function parseExRegex(source) {
	if (source instanceof RegExp)
		return parseXrx(getRegexSource(source));
	if (typeof source == "string")
		return parseXrx(source);
	return null;
}

function parseXrx(source) {
	const len = source.length,
		root = mkFrame(),
		stack = [root];
	let ptr = 0,
		buffer = "",
		withinNonterminal = false,
		parent = root;

	const err = (msg, col = ptr) => {
		const e = SyntaxError(`\n\nparser@${col + 1}\n${msg}%end%`);
		e.stack = e.stack.split("%end%")[0];
		throw e;
	};

	const pushBuffer = str => {
		buffer += str;
		ptr += str.length;
	};

	const clearBuffer = _ => {
		buffer = "";
	};

	const push = bufferOrToken => {
		const tail = parent.children[parent.children.length - 1];

		if (typeof bufferOrToken == "string" && typeof tail == "string")
			parent.children[parent.children.length - 1] += bufferOrToken;

		parent.children.push(bufferOrToken);
	};

	const pushToken = (type, data) => {
		push(
			mkToken(type, data)
		);
	};

	const pop = _ => {
		stack.pop();

		if (!stack.length)
			err("Unmatched parenthesis");

		parent = stack[stack.length - 1];
	};

	while (ptr < len) {
		const char = source[ptr];

		switch (char) {
			case "\\":
				pushBuffer(`\\${source[ptr + 1] || ""}`);
				break;

			case "<":
				ptr++;
				withinNonterminal = true;
				break;

			case ">":
				if (!withinNonterminal)
					push(">");
				else if (!buffer)
					push("<>");
				else {
					pushToken(T.NONTERMINAL, {
						raw: buffer
					});
				}

				ptr++;
				clearBuffer();
				withinNonterminal = false;
				break;

			case "(":
				
				ptr++;
				break;

			case ")":
				pop();
				ptr++;
		}
	}
}

function mkFrame(data) {
	return assign({
		children: []
	}, data);
}

function mkToken(type, data) {
	return assign({
		type
	}, data);
}
