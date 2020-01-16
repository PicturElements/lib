import { nub } from "./arr";
import { isObject } from "./is";
import { splitClean } from "./str";
import casing from "./casing";
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
			if (!hasOwn(overriderAttrs, k))
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

// The following functions work on attribute objects, which are virtual representations
// of HTML tag data. Functions that parse, process, or otherwise leverage attributes are
// recommeded to follow this schema for attribute data:
// {
//		class: string[],
//		data: object,
//		style: {
//			list: <ListItem[]>{
//				key: string,
//				value: string
//			},
//			lookup: {
//				ListItem
//			}
//		},
//		...attrs	// Any number of string-based attributes
// }
// The lookup map is referentially bound to the list

function mkAttrRepresentationObj() {
	return {
		class: [],
		data: {},
		style: mkParsedStyleObject()
	};
}

function parseStyle(style, allowFallthrough = false) {
	switch (typeof style) {
		case "string":
			return parseStyleStr(style);

		case "object":
			if (Array.isArray(style))
				return parseStyleArr(style);
			else if (isObject(style)) {
				if (style && style.isParsedStyle && allowFallthrough)
					return style;
				else if (Array.isArray(style.list))
					return parseStyleArr(style.list);
				else
					return parseStyleObj(style);
			}
	}

	return mkParsedStyleObject();
}

const styleRegex = /([a-z-]+)\s*:\s*([^;]+)\s*(?:;|$)/gi;

function parseStyleStr(str) {
	const parsed = mkParsedStyleObject();

	if (typeof str != "string")
		return parsed;

	while (true) {
		const ex = styleRegex.exec(str);
		if (!ex)
			break;

		const item = {
			key: casing(ex[1]).to.kebab,
			value: ex[2].trim()
		};

		if (!item.value)
			break;

		if (hasOwn(parsed.lookup, item.key))
			parsed.lookup[item.key].value = item.value;
		else {
			parsed.lookup[item.key] = item;
			parsed.list.push(item);
		}
	}

	return parsed;
}

function parseStyleArr(arr) {
	const parsed = mkParsedStyleObject();

	if (!Array.isArray(arr))
		return parsed;

	for (let i = 0, l = arr.length; i < l; i++) {
		const item = arr[i];

		if (!item || !item.key || !item.value)
			continue;

		if (hasOwn(parsed.lookup, item.key))
			parsed.lookup[item.key].value = item.value;
		else {
			const itm = {
				key: item.key,
				value: item.value
			};

			parsed.lookup[item.key] = itm;
			parsed.list.push(itm);
		}
	}

	return parsed;
}

function parseStyleObj(obj) {
	const parsed = mkParsedStyleObject();

	if (!Array.isArray(obj))
		return parsed;

	for (const k in obj) {
		if (!hasOwn(obj))
			continue;

		let value = obj[k];

		if (value == null)
			value = "";
		else switch (typeof value) {
			case "symbol":
			case "function":
				value = "";
				break;
			
			default:
				value = String(value);
		}
		
		const item = {
			key: casing(k).to.kebab,
			value: value.trim()
		};

		if (!item.value)
			break;

		if (hasOwn(parsed.lookup, item.key))
			parsed.lookup[item.key].value = item.value;
		else {
			parsed.lookup[item.key] = item;
			parsed.list.push(item);
		}
	}

	return parsed;
}

function mkParsedStyleObject() {
	return {
		list: [],
		lookup: {},
		isParsedStyle: true
	};
}

function joinClass(...classes) {
	return joinCls(classes, null, false);
}

function joinClassAsArray(...classes) {
	return joinCls(classes, null, true);
}

function joinClassWithArgs(...classes) {
	return (...args) => joinCls(classes, args, false);
}

function joinClassAsArrayWithArgs(...classes) {
	return (...args) => joinCls(classes, args, true);
}

function joinCls(classes, callArgs, returnAsArr) {
	const map = {},
		arr = [],
		callArgsIsArray = Array.isArray(callArgs);

	for (let i = 0, l = classes.length; i < l; i++) {
		let clsData = classes[i];

		if (typeof clsData == "function") {
			if (callArgsIsArray)
				clsData = clsData.call(...callArgs, classes);
			else
				clsData = clsData(classes);
		}

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

function joinStyle(...styles) {
	return joinStl(styles, null);
}

function joinStyleWithArgs(...styles) {
	return (...args) => joinStl(styles, args);
}

function joinStl(styles, callArgs) {
	const outStyle = mkParsedStyleObject(),
		callArgsIsArray = Array.isArray(callArgs);

	for (let i = 0, l = styles.length; i < l; i++) {
		let styleData = styles[i];

		if (typeof styleData == "function") {
			if (callArgsIsArray)
				styleData = styleData.call(...callArgs, styles);
			else
				styleData = styleData(styles);
		}

		styleData = parseStyle(styleData, true);

		for (let j = 0, l2 = styleData.list.length; j < l2; j++) {
			const item = styleData.list[j];

			if (hasOwn(outStyle.lookup, item.key))
				outStyle.lookup[item.key].value = item.value;
			else {
				const itm = {
					key: item.key,
					value: item.value
				};

				outStyle.lookup[item.key] = itm;
				outStyle.list.push(itm);
			}
		}
	}

	return outStyle;
}

function mergeAttributes(targetAttrs, sourceAttrs, config) {
	targetAttrs = targetAttrs || mkAttrRepresentationObj();

	for (let key in sourceAttrs) {
		let value = sourceAttrs[key];

		
	}

	return targetAttrs;
}

export {
	hasAncestor,
	hasAncestorBySelector,
	overrideAttributes,
	cleanAttributes,
	mkAttrRepresentationObj,
	// Parsing
	parseStyle,
	parseStyleStr,
	// Class joining
	joinClass,
	joinClassAsArray,
	joinClassWithArgs,
	joinClassAsArrayWithArgs,
	// Style joining,
	joinStyle,
	joinStyleWithArgs,
	// Attribute processing
	mergeAttributes
};
