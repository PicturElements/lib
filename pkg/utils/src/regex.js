import supports from "./internal/supports";
import hasOwn from "./has-own";
import parseRegex from "./parse-regex";
import mkCharacterSet from "./mk-character-set";

const FLAGS = [],
	FLAGS_MAP = {};

"global:g|ignoreCase:i|multiline:m|dotAll:s|unicode:u|sticky:y".split("|").forEach(s => {
	const vk = s.split(":");
	FLAGS.push(vk);
	FLAGS_MAP[vk[1]] = vk[0];
});

function compileRegex(pattern, flags) {
	try {
		return new RegExp(pattern, flags);
	} catch (e) {
		return e;
	}
}

function cleanRegex(str) {
	return str.replace(/[$^()[\]/\\{}.*+?|]/g, "\\$&");
}

const STICKY_COMPAT_FLAG = supports.regex.sticky ? "y" : "g";
function compileStickyCompatibleRegex(pattern, flags) {
	flags = typeof flags == "string" ? flags : "";

	if (pattern instanceof RegExp) {
		flags += getRegexFlags(pattern);
		pattern = getRegexSource(pattern);
	}

	return injectRegexFlags(pattern, flags + STICKY_COMPAT_FLAG, true);
}

function injectRegexFlags(rxOrSource, flags = "", instantiate = false) {
	const added = {},
		isRegex = rxOrSource instanceof RegExp;
	let additionalFlags = "";

	for (let i = 0, l = flags.length; i < l; i++) {
		const flag = flags[i],
			hasFlag = isRegex && rxOrSource[FLAGS_MAP[flag]];

		if (hasOwn(FLAGS_MAP, flag) && !hasFlag && !hasOwn(added, flag)) {
			additionalFlags += flag;
			added[flag] = true;
		}
	}

	if (!isRegex || additionalFlags || instantiate) {
		let source = rxOrSource,
			fls = "";

		if (isRegex) {
			source = getRegexSource(rxOrSource);
			fls = getRegexFlags(rxOrSource);
		}

		return new RegExp(source, fls + additionalFlags);
	}

	return rxOrSource;
}

const getRegexFlags = supports.regex.flags ?
	rx => rx.flags :
	rx => {
		const stringified = rx.toString();

		for (let i = stringified.length - 1; i > 0; i--) {
			if (stringified[i] == "/")
				return stringified.substring(i + 1);
		}
	};

const getRegexSource = supports.regex.source ?
	rx => rx.source :
	rx => {
		const stringified = rx.toString();

		for (let i = stringified.length - 1; i > 0; i--) {
			if (stringified[i] == "/")
				return stringified.substring(1, i);
		}
	};

const stickyExec = supports.regex.sticky ?
	(rx, str, lastIndex = rx.lastIndex) => {
		let r = rx;
		if (!rx.sticky)
			r = new RegExp(rx, getRegexFlags(rx) + "y");

		r.lastIndex = lastIndex || 0;

		const ex = r.exec(str);
		rx.lastIndex = r.lastIndex;
		return ex;
	} :
	(rx, str, lastIndex = rx.lastIndex) => {
		lastIndex = lastIndex || 0;

		let r = rx;
		if (!rx.global)
			r = new RegExp(getRegexSource(rx), getRegexFlags(rx) + "g");

		r.lastIndex = lastIndex;
		let ex = r.exec(str);

		if (ex && ex.index > lastIndex)
			ex = null;

		if (ex)
			rx.lastIndex = lastIndex + ex[0].length;
		else
			rx.lastIndex = 0;

		return ex;
	};

function stickyTest(rx, str, lastIndex = rx.lastIndex) {
	return Boolean(stickyExec(rx, str, lastIndex));
}

function matchAll(str, regex, captureOrCapturePriority = 0) {
	const matches = [],
		isGlobal = regex.global,
		usePriority = Array.isArray(captureOrCapturePriority),
		priority = captureOrCapturePriority,
		priorityLen = priority && priority.length;

	while (true) {
		const ex = regex.exec(str);
		if (!ex)
			return matches;

		if (ex[0].length == 0)
			regex.lastIndex++;

		let match = null;

		if (usePriority) {
			for (let i = 0; i < priorityLen; i++) {
				if (ex[priority[i]] != null) {
					match = ex[priority[i]];
					break;
				}
			}
		} else
			match = ex[captureOrCapturePriority];

		if (match != null)
			matches.push(match);

		if (!isGlobal)
			return matches;
	}
}

const T = parseRegex.TOKENS;
function getRegexMetrics(source) {
	const metrics = {
		matchStart: false,
		matchEnd: false,
		peek: null,
		ast: null
	};
	const sets = {
		positive: "",
		negative: ""
	};

	const extendSet = extension => {
		let key = "positive";
		if (extension[0] == "^") {
			key = "negative";
			extension = extension.substring(1);
		}

		if (extension[extension.length - 1] == "-")
			extension = extension.substring(0, extension.length - 1) + "\\-";

		if (extension[0] == "-")
			extension = "\\" + extension;

		sets[key] += extension;
	};

	const traverse = node => {
		switch (node.type) {
			case T.START_ASSERTION:
				metrics.matchStart = true;
				break;

			case T.END_ASSERTION:
				metrics.matchEnd = true;
				break;

			case T.SET:
				extendSet(node.value);
				if (!node.quantify || node.quantify.min > 0)
					return false;
				break;

			case T.LITERAL:
				extendSet(node.value[0]);
				break;

			case T.GROUP:
			case T.NON_CAPTURING_GROUP:
			case T.POSITIVE_LOOKAHEAD:
			case T.NEGATIVE_LOOKAHEAD: {
				let optionalChildrenCount = 0;

				for (let i = 0, l = node.children.length; i < l; i++) {
					const res = traverse(node.children[i]);

					if (res === true)
						optionalChildrenCount++;
					if (res === false)
						break;
				}

				if (node.quantify && node.quantify.min == 0)
					return true;

				return optionalChildrenCount == node.children.length;
			}
		}

		if (!node.children)
			return;

		for (let i = 0, l = node.children.length; i < l; i++) {
			if (traverse(node.children[i]) === false)
				return;
		}
	};

	const ast = parseRegex(source);
	metrics.ast = ast;
	traverse(ast);

	if (sets.positive && sets.negative) {
		const pos = mkCharacterSet(sets.positive),
			neg = mkCharacterSet("^" + sets.negative);

		metrics.peek = v => pos(v) || neg(v);
	} else if (sets.positive)
		metrics.peek = mkCharacterSet(sets.positive);
	else if (sets.negative)
		metrics.peek = mkCharacterSet("^" + sets.negative);
	else
		metrics.peek = _ => false;

	return metrics;
}

export {
	compileRegex,
	cleanRegex,
	compileStickyCompatibleRegex,
	injectRegexFlags,
	getRegexFlags,
	getRegexSource,
	stickyExec,
	stickyTest,
	matchAll,
	getRegexMetrics
};
