import { nub } from "./arr";
import { isObject } from "./is";
import { splitClean } from "./str";
import repeat from "./repeat";
import casing from "./casing";
import hasOwn from "./has-own";
import {
	VOID_TAGS,
	DOM_NAMESPACES
} from "./internal/constants";
import {
	composeOptionsTemplates,
	createOptionsObject
} from "./options";

const NS_LEN = DOM_NAMESPACES.length,
	DEF_NS = "http://www.w3.org/1999/xhtml";

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

	if (!isObject(obj))
		return parsed;

	for (const k in obj) {
		if (!hasOwn(obj, k))
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

function printClass(classes) {
	if (typeof classes == "string")
		return classes;

	let out = "";

	if (Array.isArray(classes)) {
		for (let i = 0, l = classes.length; i < l; i++) {
			if (i > 0)
				out += " ";

			out += classes[i];
		}
	} else if (isObject(classes)) {
		let count = 0;

		for (const k in classes) {
			if (classes[k] && hasOwn(classes, k)) {
				if (count > 0)
					out += " ";

				out += k;
				count++;
			}
		}
	}

	return out;
}

function printStyle(style) {
	style = parseStyle(style, true);

	let out = "";

	for (let i = 0, l = style.list.length; i < l; i++) {
		const { key, value } = style.list[i];

		if (i > 0)
			out += "; ";

		out += `${key}: ${value}`;
	}

	return out;
}

const optionsTemplates = composeOptionsTemplates({
	minified: true,
	raw: true
});

function genDom(nodes, options = {}) {
	options = createOptionsObject(options, optionsTemplates);
	
	if (isObject(nodes))
		nodes = [nodes];

	const frag = document.createDocumentFragment(),
		raw = options.raw,
		minified = typeof options.minified == "boolean" ? options.minified : false,
		indentStr = minified ?
			"" :
			(typeof options.indent == "string" ? options.indent : "\t");

	let str = "";

	if (!Array.isArray(nodes) || !nodes.length)
		return frag;

	const gen = (nds, parent, indent) => {
		if (!Array.isArray(nds))
			return;
		
		for (let i = 0, l = nds.length; i < l; i++) {
			const node = nds[i];

			if (raw) {
				if (!minified && str)
					str += "\n";
			}

			if (node.type == "text") {
				if (raw) {
					if (minified && i > 0 && nds[i - 1].type == "text")
						str += "\\n";

					str += repeat(indentStr, indent) + node.content;
				} else
					parent.appendChild(document.createTextNode(node.content));

				continue;
			}
			
			let el;

			if (raw)
				str += `${repeat(indentStr, indent)}<${node.tag}`;
			else
				el = document.createElementNS(node.namespace || DEF_NS, node.tag);

			for (const k in node.attributes) {
				if (!hasOwn(node.attributes, k))
					continue;

				const attr = node.attributes[k];

				switch (k) {
					case "style":
						setAttr(k, printStyle(attr) || null, el);
						break;

					case "class":
						setAttr(k, printClass(attr) || null, el);
						break;

					case "data":
						for (const k2 in attr) {
							if (hasOwn(attr, k2))
								setAttr(casing(k2).to.data, attr[k2], el);
						}
						break;

					default:
						setAttr(k, attr, el);
				}
			}

			if (raw)
				str += ">";

			if (!node.void) {
				const children = Array.isArray(node.children) && node.children.length ?
					node.children :
					null;

				if (children) {
					gen(children, el, indent + 1);

					if (!minified && raw)
						str += `\n${repeat(indentStr, indent)}`;
				}

				if (raw)
					str += `<${node.tag}>`;
			}

			if (!raw)
				parent.appendChild(el);
		}
	};

	const setAttr = (key, value, el) => {
		if (value == null)
			return;

		if (raw)
			str += ` ${key}="${value}"`;
		else
			el.setAttribute(key, value);
	};
	
	gen(nodes, frag, 0);

	if (raw)
		return str;

	if (nodes.length == 1)
		return frag.firstChild;

	return frag;
}

function getTagProperties(tag) {
	let props = {
		tag,
		void: VOID_TAGS.has(tag),
		namespace: DEF_NS
	};

	for (let i = 0; i < NS_LEN; i++) {
		let nsi = DOM_NAMESPACES[i];

		if (nsi.tags.has(tag)) {
			props.tag = nsi.tagGetter(tag);
			props.namespace = nsi.uri;
			break;
		}
	}

	return props;
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
	mergeAttributes,
	// Printing / rendering
	printClass,
	printStyle,
	genDom,
	// Meta
	getTagProperties
};
