function getWrappedRange(from, to, len, relative) {
	from = typeof from == "number" ? from || 0 : 0;
	from = from < 0 ? len + from : from;
	to = typeof to == "number" ? to || 0 : 0;

	if (relative) {
		if (to < 0) {
			const delta = to;
			to = from;
			from = from + delta;
		} else
			to += from;
	} else
		to = to < 0 ? len + to : to;

	from = Math.min(Math.max(from, 0), len);
	to = Math.min(Math.max(to, from), len);

	return [from, to];
}

export {
	getWrappedRange
};
