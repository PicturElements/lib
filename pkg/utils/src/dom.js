function hasAncestor(elem, cls, maxDepth = Infinity) {
	while (true) {
		if (!elem || elem == document.documentElement)
			return false;

		if (elem.classList.contains(cls))
			return true;

		if (--maxDepth < 0)
			return false;

		elem = elem.parentNode;
	}
}

export {
	hasAncestor
};
