import { nub } from "./arr";
import { isObject } from "./is";
import { splitClean } from "./str";
import hasOwn from "./has-own";

function hasAncestor(elem, clsOrElem, maxDepth = Infinity) {
	const searchByClass = typeof clsOrElem == "string";

	while (true) {
		if (!elem || elem == document.documentElement)
			return false;

		if (searchByClass) {
			if (elem.classList && elem.classList.contains(clsOrElem))
				return true;
		} else if (elem == clsOrElem)
			return true;

		if (--maxDepth < 0)
			return false;

		elem = elem.parentNode;
	}
}

function hasAncestorBySelector(elem, selectorOrElem, maxDepth = Infinity) {
	const searchBySelector = typeof selectorOrElem == "string";

	while (true) {
		if (!elem || elem == document.documentElement)
			return false;

		if (searchBySelector) {
			if (elem.nodeType == 1 && elem.matches(selectorOrElem))
				return true;
		} else if (elem == selectorOrElem)
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

function joinClass(...classes) {
	return join(false, classes);
}

function joinClassAsArray(...classes) {
	return join(true, classes);
}

function join(returnAsArr, classes) {
	const map = {},
		arr = [];

	for (let i = 0, l = classes.length; i < l; i++) {
		let clsData = classes[i];

		if (typeof clsData == "function")
			clsData = clsData.call(this, this.form);

		if (typeof clsData == "string")
			clsData = splitClean(clsData);

		if (Array.isArray(clsData)) {
			for (let j = clsData.length - 1; j >= 0; j--) {
				const cl = clsData[j];

				if (!cl || typeof cl != "string" || hasOwn(map, cl))
					continue;

				map[cl] = true;

				if (returnAsArr)
					arr.push(cl);
			}
		} else if (isObject(clsData)) {
			for (const k in clsData) {
				if (!clsData[k] || !hasOwn(clsData, k) || hasOwn(map, k))
					continue;

				map[k] = clsData[k];

				if (returnAsArr)
					arr.push(k);
			}
		}
	}

	return returnAsArr ? arr : map;
}

export {
	hasAncestor,
	hasAncestorBySelector,
	overrideAttributes,
	cleanAttributes,
	joinClass,
	joinClassAsArray
};
