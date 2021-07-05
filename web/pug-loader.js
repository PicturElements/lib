const pugPlainLoader = require("pug-plain-loader");

// This loader wraps pug-plain-loader and removes undesired indentation
// so that no parsing errors occur within the Vue parser

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

module.exports = function(...args) {
	args[0] = untab(args[0], null, true);
	return pugPlainLoader.apply(this, args);
};
