import supports from "./supports";
import hasOwn from "./has-own";

const FLAGS = [],
	FLAGS_MAP = {},
	RX_TO_STR = RegExp.prototype.toString;

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

function joinRegexFlags(...flagSources) {
	const added = {};
	let out = "";

	for (let i = 0, l = flagSources.length; i < l; i++) {
		const flags = flagSources[i] instanceof RegExp ?
			getRegexFlags(flagSources[i]) :
			flagSources[i];

		if (typeof flags != "string")
			continue;

		for (let i = 0, l = flags.length; i < l; i++) {
			const flag = flags[i];

			if (hasOwn(FLAGS_MAP, flag) && !hasOwn(added, flag)) {
				out += flag;
				added[flag] = true;
			}
		}
	}

	return out;
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
		const stringified = RX_TO_STR.call(rx);

		for (let i = stringified.length - 1; i > 0; i--) {
			if (stringified[i] == "/")
				return stringified.substring(i + 1);
		}
	};

const getRegexSource = supports.regex.source ?
	rx => rx.source :
	rx => {
		const stringified = RX_TO_STR.call(rx);

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

		if (ex && ex.index != lastIndex)
			ex = null;

		if (ex)
			rx.lastIndex = lastIndex + ex[0].length;
		else
			rx.lastIndex = lastIndex;

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

function mkDisallowedWordsRegex(words, naked = false) {
	if (!Array.isArray(words))
		words = [words];

	const lookaheads = [],
		lookaheadsLookup = {},
		lookaheadsInitialLookup = {},
		negations = [],
		negationsLookup = {};

	for (let i = 0, l = words.length; i < l; i++) {
		const word = words[i];
		if (typeof word != "string")
			continue;

		const head = word[0],
			escapedHead = /\]|\\|-/.test(head) ?
				"\\" + head :
				head,
			tail = word.slice(1);

		if (!hasOwn(negationsLookup, head)) {
			negations.push(escapedHead);
			negationsLookup[head] = true;
		}

		if (!tail || hasOwn(lookaheadsLookup, word))
			continue;

		const lookahead = hasOwn(lookaheadsInitialLookup, head) ?
			lookaheadsInitialLookup[head] :
			{
				head: cleanRegex(head),
				content: ""
			};

		if (!hasOwn(lookaheadsInitialLookup, head)) {
			lookaheads.push(lookahead);
			lookaheadsInitialLookup[head] = lookahead;
		}

		if (lookahead.content)
			lookahead.content += "|";

		lookahead.content += cleanRegex(tail);
	}

	if (!negations.length)
		return ".";

	const negation = `[^${negations.join("")}]`;

	if (!lookaheads.length)
		return negation;

	let lookaheadsContent = "";

	for (let i = 0, l = lookaheads.length; i < l; i++)
		lookaheadsContent += `${lookaheads[i].head}(?!${lookaheads[i].content})|`;

	return naked ?
		lookaheadsContent + negation :
		`(?:${lookaheadsContent}${negation})`;
}

export {
	compileRegex,
	cleanRegex,
	compileStickyCompatibleRegex,
	joinRegexFlags,
	injectRegexFlags,
	getRegexFlags,
	getRegexSource,
	stickyExec,
	stickyTest,
	matchAll,
	mkDisallowedWordsRegex
};
