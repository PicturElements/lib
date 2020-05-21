import { nub } from "./arr";
import { isObject } from "./is";
import { splitClean } from "./str";
import forEach from "./for-each";
import casing from "./casing";
import hasOwn from "./has-own";
import parseEntityStr from "./parse-entity-str";
import {
	VOID_TAGS,
	DOM_NAMESPACES
} from "./internal/constants";
import {
	composeOptionsTemplates,
	createOptionsObject
} from "./internal/options";

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

function joinAttributes(...attrs) {
	const outAttrs = mkAttrRepresentationObj();

	for (let i = 0, l = attrs.length; i < l; i++) {
		const src = attrs[i];

		for (let k in src) {
			if (!hasOwn(src, k))
				continue;

			switch (k) {
				case "style":
					outAttrs.style = joinStyle(outAttrs.style, src.style);
					break;

				case "class":
					outAttrs.class = joinClassAsArray(outAttrs.class, src.class);
					break;

				case "data":
					Object.assign(outAttrs.data, src.data);
					break;

				default:
					outAttrs[k] = src[k];
			}
		}
	}

	return outAttrs;
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
	comments: true,
	raw: true
});

// Ugly but highly flexible DOM generator
// This utility supports the following inputs:
// 1.	object, object[]
//		Object representation of a node, as emitted by parsePugStr, etc
// 2.	Node, Node[]
//		Native Node DOM tree
function genDom(nodes, options = {}) {
	options = createOptionsObject(options, optionsTemplates);

	if (nodes instanceof Node && nodes.nodeType == Node.DOCUMENT_FRAGMENT_NODE)
		nodes = nodes.children;
	else if (!Array.isArray(nodes))
		nodes = [nodes];

	const raw = options.raw,
		root = raw ?
			"" :
			document.createDocumentFragment(),
		minified = typeof options.minified == "boolean" ?
			options.minified :
			false,
		comments = options.comments,
		indentStr = minified ?
			"" :
			(typeof options.indent == "string" ? options.indent : "\t"),
		processAttribute = typeof options.processAttribute == "function" ? options.processAttribute : null,
		processAttributes = typeof options.processAttributes == "function" ? options.processAttributes : null,
		processType = typeof options.processType == "function" ? options.processType : null,
		processTag = typeof options.processTag == "function" ? options.processTag : null;

	if (!nodes.length)
		return root;
	
	const useNativeNodes = nodes[0] instanceof Node;
	let str = "";

	const gen = (nds, parent, indent) => {
		if (!nds || !nds.length)
			return;
		
		for (let i = 0, l = nds.length; i < l; i++) {
			const node = nds[i],
				breakStr = (!minified && str) ? "\n" : "";
			let type = getNodeType(node),
				tag = getTagName(node);

			if (processType) {
				type = processType({
					type,
					sourceNode: node
				}) || type;
			}

			if (processTag) {
				tag = processTag({
					tag,
					sourceNode: node
				}) || tag;
			}

			if (type == "fragment") {
				const children = useNativeNodes ?
					node.childNodes :
					node.children;

				if (children && children.length)
					gen(children, parent, indent);

				continue;
			}

			if (type == "comment") {
				if (!comments || (raw && minified))
					continue;

				const content = useNativeNodes ?
					node.textContent :
					node.content.trim();

				if (raw)
					str += `${breakStr}${indent}<!-- ${content} -->`;
				else
					parent.appendChild(document.createComment(content));

				continue;
			}

			if (raw)
				str += breakStr;

			if (type == "text") {
				const content = useNativeNodes ?
					node.textContent :
					parseEntityStr(node.content);

				if (raw) {
					if (minified && i > 0 && getNodeType(nds[i - 1]) == "text")
						str += "\\n";

					str += indent + content;
				} else
					parent.appendChild(document.createTextNode(content));

				continue;
			}
			
			let nd;

			if (raw)
				str += `${indent}<${tag}`;
			else {
				if (useNativeNodes)
					nd = document.createElementNS(node.namespaceURI, tag);
				else
					nd = document.createElementNS(node.namespace || DEF_NS, tag);
			}

			let attributes = node.attributes;

			if (processAttributes) {
				const attrs = [],
					attrsMap = {},
					indexMap = {};

				forEach(attributes, (value, key) => {
					if (useNativeNodes) {
						key = value.name;
						value = value.nodeValue;
					}

					indexMap[key] = attrs.length;
					attrs.push([key, value]);
					attrsMap[key] = value;
				});

				const set = (key, value) => {
					if (isObject(key)) {
						for (const k in key) {
							if (hasOwn(key, k))
								set(k, key[k]);
						}

						return;
					}

					if (!hasOwn(indexMap, key))
						indexMap[key] = attrs.length;

					attrs[indexMap[key]] = [key, value];
				};

				processAttributes({
					attributes: attrsMap,
					set,
					node: nd,
					sourceNode: node
				});

				attributes = attrs;
			}

			forEach(attributes, (value, key) => {
				if (processAttributes) {
					key = value[0];
					value = value[1];
				} else if (useNativeNodes) {
					key = value.name;
					value = value.nodeValue;
				}

				switch (key) {
					case "style":
						setAttr(key, printStyle(value) || null, value, nd, node);
						break;

					case "class":
						setAttr(key, printClass(value) || null, value, nd, node);
						break;

					case "data":
						for (const k2 in value) {
							if (hasOwn(value, k2))
								setAttr(casing(k2).to.data, value[k2], value, nd, node);
						}
						break;

					default:
						setAttr(key, value, value, nd, node);
				}
			});

			if (raw)
				str += ">";

			if (!node.void && (!useNativeNodes || !getTagProperties(node).void)) {
				const children = useNativeNodes ?
					node.childNodes :
					node.children;

				if (children && children.length) {
					gen(children, nd, indent + indentStr);

					if (!minified && raw)
						str += `\n${indent}`;
				}

				if (raw)
					str += `</${tag}>`;
			}

			if (!raw)
				parent.appendChild(nd);
		}
	};

	const setAttr = (key, value, rawValue, node, sourceNode) => {
		if (processAttribute) {
			value = processAttribute({
				key,
				value,
				rawValue,
				node,
				sourceNode
			});
		}

		if (value == null)
			return;

		value = String(value);

		if (raw) {
			if (!value)
				str += ` ${key}`;
			else
				str += ` ${key}="${value}"`;
		} else
			node.setAttribute(key, value);
	};
	
	gen(nodes, root, "");

	if (raw)
		return str;

	if (nodes.length == 1)
		return root.firstChild;

	return root;
}

function serializeDom(nodes, options = {}) {
	return genDom(nodes, ["raw|minified", options]);
}

function getTagProperties(tag) {
	if (tag instanceof Node)
		tag = getTagName(tag);

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

function getNodeType(node) {
	if (node instanceof Node) {
		switch (node.nodeType) {
			case Node.ELEMENT_NODE:
				return "element";
			case Node.TEXT_NODE:
				return "text";
			case Node.CDATA_SECTION_NODE:
				return "cdata";
			case Node.PROCESSING_INSTRUCTION_NODE:
				return "processing-instruction";
			case Node.COMMENT_NODE:
				return "comment";
			case Node.DOCUMENT_NODE:
				return "document";
			case Node.DOCUMENT_TYPE_NODE:
				return "doctype";
			case Node.DOCUMENT_FRAGMENT_NODE:
				return "fragment";
			default:
				return null;
		}
	} else if (node && typeof node.type == "string")
		return node.type;
	
	return null;
}

function getTagName(node) {
	if (node instanceof Node) {
		if (node.namespaceURI == DEF_NS)
			return node.tagName.toLowerCase();

		return node.tagName;
	} else if (node && typeof node.tag == "string")
		return node.tag;

	return null;
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
	// Style joining
	joinStyle,
	joinStyleWithArgs,
	// Attribute processing
	joinAttributes,
	// Printing / rendering
	printClass,
	printStyle,
	genDom,
	serializeDom,
	// Information
	getTagProperties,
	getNodeType
};
