import { nub } from "./arr";

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

function overrideAttributes(attrs, ...overriders) {
	for (let i = 0, l = overriders.length; i < l; i++) {
		const overriderAttrs = overriders[i];

		for (const k in overriderAttrs) {
			if (!overriderAttrs.hasOwnProperty(k))
				continue;

			switch (k) {
				case "class":
					attrs.class = attrs.class.concat(overriderAttrs.class);
					break;

				case "data":
					Object.assign(attrs.data, overriderAttrs.data);
					break;

				default:
					attrs[k] = overriderAttrs[k];
			}
		} 
	}

	cleanAttributes(attrs);
	return attrs;
}

// This is applied on object representations
// and not on actual DOM nodes
function cleanAttributes(attrs) {
	attrs.class = nub(attrs.class);
}

export {
	hasAncestor,
	overrideAttributes,
	cleanAttributes
};
