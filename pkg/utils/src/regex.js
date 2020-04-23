function cleanRegex(str) {
	return str.replace(/[$^()[\]/\\{}.*+?|]/g, "\\$&");
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

export {
	cleanRegex,
	matchAll
};
