function matchAll(str, regex, captureOrCapturePriority = 0) {
	if (!regex.global) {
		const ex = regex.exec(str);
		return ex ? [ex[0]] : [];
	}

	const matches = [],
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
	}
}

export {
	matchAll
};
