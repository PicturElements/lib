import concatMut from "./concat-mut";
import parseStr from "./parse-str";
import forEach from "./for-each";
import casing from "./casing";
import serialize from "./serialize";
import hasOwn from "./has-own";
import parseEntityStr from "./parse-entity-str";
import { nub } from "./arr";
import {
	isObject,
	isPrimitive,
	isEmptyString
} from "./is";
import { splitClean } from "./str";
import {
	VOID_TAGS,
	BOOLEAN_ATTRS,
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

// The following functions work on attribute objects, which are virtual representations
// of HTML tag data. Functions that parse, process, or otherwise leverage attributes are
// recommeded to follow this schema for attribute data:
// {
//		class: TokenList,
//		data: TokenList,
//		style: TokenList,
//		events: TokenList,
//		...attrs	// Any number of attributes
// }
//
// where TokenLists follow this interface:
// {
//		list: <ListItem[]>{
//			key: string,
//			value: string
//		},
//		lookup: {
//			ListItem
//		}
// }
//
// The lookup map is referentially bound to the list
// and is used to set/update values

function mkAttrRepresentationObj() {
	return {
		class: mkClassList(),
		data: mkDatasetList(),
		style: mkStyleList(),
		events: mkEventList()
	};
}

function mkClassList() {
	const list = mkTokenList();
	list.isParsedClass = true;
	return list;
}

function mkStyleList() {
	const list = mkTokenList();
	list.isParsedStyle = true;
	return list;
}

function mkDatasetList() {
	const list = mkTokenList();
	list.isParsedDataset = true;
	return list;
}

function mkEventList() {
	const list = mkTokenList();
	list.isParsedEvents = true;
	return list;
}

function mkTokenList() {
	return {
		list: [],
		lookup: {},
		keys: [],
		map: {},
		isTokenList: true
	};
}

function appendToken(list, token, clone = false) {
	if (!token)
		return null;

	if (typeof token == "string") {
		token = {
			key: token,
			value: token
		};
	} else if (clone) {
		token = {
			key: token.key,
			value: token.value
		};
	}
	
	if (token.key && token.value) {
		if (hasOwn(list.lookup, token.key)) {
			list.lookup[token.key].value = token.value;
			list.map[token.key] = token.value;
		} else {
			list.lookup[token.key] = token;
			list.map[token.key] = token.value;
			list.list.push(token);
			list.keys.push(token.key);
		}

		return token;
	}

	return null;
}

function removeToken(list, keyOrToken) {
	const key = typeof keyOrToken == "string" ?
		keyOrToken :
		keyOrToken && keyOrToken.key;

	if (typeof key != "string" || !hasOwn(list.lookup, key))
		return false;

	let offs = 0;

	for (let i = 0, l = list.list.length; i < l; i++) {
		if (!offs) {
			if (list.list[i].key == key)
				offs = 1;
		} else {
			list.list[i - offs] = list.list[i];
			list.keys[i - offs] = list.keys[i];
		}
	}

	delete list.lookup[key];
	delete list.map[key];
	list.list.length--;
	list.keys.length--;
	return true;
}

// Style
function parseStyle(style, allowFallthrough = false) {
	if (allowFallthrough && style && style.isParsedStyle)
		return style;

	return joinStyle(style);
}

const styleRegex = /([a-z-]+)\s*:\s*([^;]+)\s*(?:;|$)/gi;

function parseStyleStr(list, str) {
	if (typeof str != "string")
		return list;

	while (true) {
		const ex = styleRegex.exec(str);
		if (!ex)
			break;

		appendToken(list, {
			key: casing(ex[1]).to.kebab,
			value: ex[2].trim()
		});
	}

	return list;
}

function joinStyle(...styles) {
	return joinStl(styles, null);
}

function joinStyleWithArgs(...styles) {
	return (...args) => joinStl(styles, args);
}

function extendStyle(stl, ...styles) {
	const list = parseStyle(stl, true);
	return joinStlHelper(list, styles);
}

function extendStyleWithArgs(stl, ...styles) {
	return (...args) => {
		const list = parseStyle(stl, true);
		return joinStlHelper(list, styles, args);
	};
}

function joinStl(styles, callArgs) {
	if (!Array.isArray(callArgs))
		callArgs = null;

	const list = mkStyleList();
	return joinStlHelper(list, styles, callArgs);
}

function joinStlHelper(list, style, callArgs) {
	if (typeof style == "function") {
		if (callArgs)
			style = style(...callArgs);
		else
			style = style();
	}

	if (style && style.isParsedStyle) {
		for (let i = 0, l = style.list.length; i < l; i++)
			appendToken(list, style.list[i], true);
	} else if (Array.isArray(style)) {
		for (let i = 0, l = style.length; i < l; i++)
			joinStlHelper(list, style[i], callArgs);
	} else if (typeof style == "string")
		parseStyleStr(list, style);
	else if (isObject(style)) {
		for (const k in style) {
			if (!hasOwn(style, k))
				continue;

			let val = style[k];

			if (typeof val == "function") {
				if (callArgs)
					val = val(...callArgs);
				else
					val = val();
			}

			if (typeof val != "string")
				continue;

			appendToken(list, {
				key: casing(k).to.kebab,
				value: val.trim()
			});
		}
	}

	return list;
}

// Classes
function parseClass(cls, allowFallthrough = false) {
	if (allowFallthrough && cls && cls.isParsedClass)
		return cls;

	return joinClass(cls);
}

function joinClass(...classes) {
	return joinCls(classes);
}

function joinClassAsArray(...classes) {
	return joinCls(classes, null, "array");
}

function joinClassAsTokenList(...classes) {
	return joinCls(classes, null, "tokenlist");
}

function joinClassWithArgs(...classes) {
	return (...args) => joinCls(classes, args);
}

function joinClassAsArrayWithArgs(...classes) {
	return (...args) => joinCls(classes, args, "array");
}

function joinClassAsTokenListWithArgs(...classes) {
	return (...args) => joinCls(classes, args, "tokenlist");
}

function extendClass(cls, ...classes) {
	const list = parseClass(cls, true);
	return joinClsHelper(list, classes);
}

function extendClassWithArgs(cls, ...classes) {
	return (...args) => {
		const list = parseClass(cls, true);
		return joinClsHelper(list, classes, args);
	};
}

function joinCls(classes, callArgs, returnType = "object") {
	if (!Array.isArray(callArgs))
		callArgs = null;

	const list = mkClassList();
	joinClsHelper(list, classes, callArgs);

	switch (returnType) {
		case "array":
			return list.keys;

		case "object":
			return list.map;

		case "tokenlist":
		default:
			return list;
	}
}

function joinClsHelper(list, cls, callArgs) {
	if (typeof cls == "function") {
		if (callArgs)
			cls = cls(...callArgs);
		else
			cls = cls();
	}

	if (cls && cls.isParsedClass) {
		for (let i = 0, l = cls.list.length; i < l; i++)
			appendToken(list, cls.list[i], true);
	} else if (Array.isArray(cls)) {
		for (let i = 0, l = cls.length; i < l; i++)
			joinClsHelper(list, cls[i], callArgs);
	} else if (typeof cls == "string") {
		const split = splitClean(cls);

		for (let i = 0, l = split.length; i < l; i++) {
			appendToken(list, {
				key: split[i],
				value: true
			});
		}
	} else if (isPrimitive(cls)) {
		appendToken(list, {
			key: String(cls),
			value: true
		});
	} else if (isObject(cls)) {
		for (const k in cls) {
			if (!hasOwn(cls, k))
				continue;

			let val = cls[k];

			if (typeof val == "function") {
				if (callArgs)
					val = val(...callArgs);
				else
					val = val();
			}

			if (!val)
				continue;

			appendToken(list, {
				key: k,
				value: true
			});
		}
	}
}

// Datasets
function parseDataset(ds, allowFallthrough = false) {
	if (allowFallthrough && ds && ds.isParsedDataset)
		return ds;

	return joinDatasets(ds);
}

function joinDatasets(...data) {
	const list = mkDatasetList();
	return joinDatasetsHelper(list, data);
}

function extendDataset(ds, ...data) {
	const list = parseDataset(ds, true);
	return joinDatasetsHelper(list, data);
}

function joinDatasetsHelper(list, data) {
	for (let i = 0, l = data.length; i < l; i++) {
		let d = data[i];

		if (d && d.isParsedDataset) {
			for (let j = 0, l2 = d.list.length; j < l2; j++)
				appendToken(list, d.list[j], true);
		} else if (Array.isArray(d))
			joinDatasetsHelper(list, d);
		else if (isObject(d)) {
			for (const k in d) {
				if (!d[k] || !hasOwn(d, k))
					continue;

				appendToken(list, {
					key: k,
					value: d[k]
				});
			}
		}
	}

	return list;
}

// Events
function parseEvents(evts, allowFallthrough = false) {
	if (allowFallthrough && evts && evts.isParsedEvents)
		return evts;

	return joinEvents(evts);
}

function joinEvents(...events) {
	const list = mkEventList();
	return joinEventsHelper(list, events);
}

function extendEvents(evts, ...events) {
	const list = parseEvents(evts, true);
	return joinEventsHelper(list, events);
}

function joinEventsHelper(list, events) {
	for (let i = 0, l = events.length; i < l; i++) {
		let evts = events[i];

		if (evts && evts.isParsedEvents) {
			for (let j = 0, l2 = evts.list.length; j < l2; j++)
				appendToken(list, evts.list[j], true);
		} else if (Array.isArray(evts))
			joinDatasetsHelper(list, evts);
		else if (isObject(evts)) {
			for (const k in evts) {
				if (!evts[k] || !hasOwn(evts, k))
					continue;

				appendToken(list, {
					key: k,
					value: evts[k]
				});
			}
		}
	}

	return list;
}

// General attributes
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
					outAttrs.class = joinClassAsTokenList(outAttrs.class, src.class);
					break;

				case "data":
					outAttrs.data = joinDatasets(outAttrs.data, src.data);
					break;

				default:
					if (k.indexOf("data-") == 0) {
						appendToken(outAttrs.data, {
							key: casing(k).from.data.to.camel,
							value: src[k]
						});
					} else if (k.indexOf("on") == 0) {
						appendToken(outAttrs.events, {
							key: k.substring(2),
							value: src[k]
						});
					} else
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
	} else if (classes && classes.isParsedClass)
		out = classes.keys.join(" ");
	else if (isObject(classes)) {
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
						str += "\n";

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
						if (value && value.isParsedDataset) {
							for (let j = 0, l2 = value.list.length; j < l2; j++) {
								const token = value.list[j];
								setAttr(casing(token.key).to.data, token.value, value, nd, node);
							}
						} else {
							for (const k2 in value) {
								if (hasOwn(value, k2))
									setAttr(casing(k2).to.data, value[k2], value, nd, node);
							}
						}
						break;

					case "events":
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

		const isBooleanAttr = BOOLEAN_ATTRS.has(key);

		if (value == null || (isBooleanAttr && value == false))
			return;

		if (isBooleanAttr)
			value = "";
		else
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

	if (nodes.length == 1 || root.childNodes.length == 1)
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

// VDOM utilities
// Capturing groups:
// 1: key
// 2: value
// 3: string quote character
const ATTR_SPLIT_REGEX = /([\w-.:]+)(?:\s*=\s*((["'`])(?:[^\\]|\\.)*?\3|[^"'`\s]+))?/g,
	REF_REGEX = /ref_[a-zA-Z0-9]{15}/g,
	DEFAULT_TAGS = {
		comment: "#comment",
		text: "#text",
		element: "div"
	};

function mkVNode(type, data) {
	const node = Object.assign({
		type,
		raw: "",
		tag: null
	}, data);

	node.tag = node.tag || DEFAULT_TAGS[type];

	if (type == "element") {
		const props = getTagProperties(node.tag);
		node.tag = props.tag;
		node.namespace = props.namespace;
		node.void = props.void;
	}

	return node;
}

// Extend dynamic value with data
const DV_EXTENDERS = {
	default: (dv, data) => dv,
	singleton: (dv, data) => dv.data = data,
	ordered: (dv, data) => {
		concatMut(dv.data, data);
		return dv;
	},
	partitioned: (dv, data) => {
		const d = Array.isArray(data) ?
			data :
			[data];

		for (let i = 0, l = d.length; i < l; i++) {
			const item = d[i];

			if (item && item.isDynamicValue)
				dv.dynamic.push(item);
			else
				dv.static.push(item);
		}

		return dv;
	},
	tokenlist: (dv, data) => {
		const jn = dv.joiner || dv.merger;
		let staticTokens = [],
			dynamicTokens = [];

		if (Array.isArray(data)) {
			for (let i = 0, l = data.length; i < l; i++) {
				if (typeof data[i] == "function")
					dynamicTokens.push(data[i]);
				else
					staticTokens.push(data[i]);
			}
		} else if (data && data.isTokenList)
			staticTokens.push(data);
		else if (isObject(data) && (data.static || data.dynamic)) {
			staticTokens = data.static || staticTokens;
			dynamicTokens = data.dynamic || dynamicTokens;
		} else if (typeof data == "function")
			dynamicTokens.push(data);
		else
			staticTokens.push(data);

		if (staticTokens.length)
			dv.staticTokens = jn(dv.staticTokens, ...staticTokens);
		if (dynamicTokens.length)
			concatMut(dv.dynamicTokens, dynamicTokens);
	}
};

// Merge dynamic value with other dynamic value
const DV_MERGERS = {
	default: (dv, dv2) => dv,
	singleton: (dv, dv2) => dv.data = dv2.data,
	ordered: (dv, dv2) => {
		concatMut(dv.data, dv2.data);
		return dv;
	},
	partitioned: (dv, dv2) => {
		concatMut(dv.dynamic, dv2.dynamic);
		concatMut(dv.static, dv2.static);
		return dv;
	},
	tokenlist: (dv, dv2) => {
		const mrg = dv.merger || dv.joiner;
		dv.staticTokens = mrg(dv.staticTokens, dv2.staticTokens);
		concatMut(dv.dynamicTokens, dv2.dynamicTokens);
		return dv;
	}
};

// Extract data from dynamic value
const DV_EXTRACTORS = {
	default: dv => dv,
	singleton: (dv, args) => {
		if (typeof dv.data == "function")
			return dv.data(...args);

		return dv.data;
	},
	ordered: dv => dv.data,
	partitioned: dv => dv.dynamic.concat(dv.static),
	tokenlist: (dv, args) => {
		const extr = dv.extractor || dv.joiner || dv.merger,
			resolvedTokens = [];

		for (let i = 0, l = dv.dynamicTokens.length; i < l; i++)
			resolvedTokens.push(dv.dynamicTokens[i](...args));

		return extr(dv.staticTokens, ...resolvedTokens);
	}
};

// Create dynamic value resolver object with associated helper methods
// Takes an optional "value" field, which is fed into the assigned
// extender method on init
function mkDynamicValue(dv) {
	dv.type = dv.type || "partitioned";
	dv.extend = dv.extend || DV_EXTENDERS[dv.type] || DV_EXTENDERS.default;
	dv.merge = dv.merge || DV_MERGERS[dv.type] || DV_MERGERS.default;
	dv.extract = dv.extract || DV_EXTRACTORS[dv.type] || DV_EXTRACTORS.default;
	dv.isDynamicValue = true;

	switch (dv.type) {
		case "singleton":
			dv.data = dv.data || null;
			break;

		case "ordered":
			dv.data = dv.data || [];
			break;

		case "partitioned":
			dv.dynamic = dv.dynamic || [];
			dv.static = dv.static || [];
			break;

		case "tokenlist":
			dv.staticTokens = dv.staticTokens || mkTokenList();
			dv.dynamicTokens = dv.dynamicTokens || [];
			break;
	}

	if (dv.value) {
		extendDynamicValue(dv, dv.value);
		delete dv.value;
	}
	
	return dv;
}

function extendDynamicValue(dv, data) {
	return dv.extend(dv, data);
}

function mergeDynamicValue(dv, dv2) {
	return dv.merge(dv, dv2);
}

function resolveDynamicValue(dv, args = []) {
	if (!Array.isArray(args))
		args = [args];

	return dv.extract(dv, args);
}

function isDynamicValueCandidate(value, meta = null) {
	switch (typeof value) {
		case "object":
			return value !== null && !meta.options.lazyDynamic;

		case "function":
			return true;
	}

	return false;
}

function setAttribute(node, key, value) {
	const attrs = node.attributes,
		attr = attrs[key];

	if (BOOLEAN_ATTRS.has(key) && value === false)
		return;

	if (value && value.isDynamicValue) {
		if (hasOwn(node.dynamicAttributesMap, key))
			mergeDynamicValue(attr, value);
		else {
			node.static = false;
			node.dynamicAttributes.push(key);
			node.dynamicAttributesMap[key] = value;
			if (hasOwn(attrs, key))
				extendDynamicValue(value, attr);
			attrs[key] = value;
		}
	} else if (attr && attr.isDynamicValue)
		extendDynamicValue(attr, value);
	else {
		const listLen = attr && attr.isTokenList && attr.list.length;
		if (!hasOwn(attrs, key))
			node.staticAttributes.push(key);

		if (Array.isArray(attr))
			concatMut(attr, value);
		else if (attr && attr.isTokenList) {
			if (attr.isParsedStyle)
				extendStyle(attr, value);
			else if (attr.isParsedClass)
				extendClass(attr, value);
			else if (attr.isParsedDataset)
				extendDataset(attr, value);
			else if (attr.isParsedEvents)
				extendEvents(attr, value);
		} else if (isObject(attr) && isObject(value))
			Object.assign(attr, value);
		else
			attrs[key] = value;

		if (listLen == 0 && attrs[key] && attrs[key].isTokenList && attrs[key].list.length)
			node.staticAttributes.push(key);
	}
}

function parseAttributes(node, meta = null) {
	if (!node.attrData)
		return;
	
	while (true) {
		const ex = ATTR_SPLIT_REGEX.exec(node.attrData);
		if (!ex)
			break;

		const key = ex[1],
			value = ex[2] === undefined ? true : parseStr(ex[2]);

		switch (key) {
			case "class":
				setAttribute(
					node,
					"class",
					meta ?
						resolveInlineRefs(value, meta, "class") :
						String(value).terms(/\s+/g)
				);
				break;

			case "style":
				setAttribute(
					node,
					"style",
					resolveInlineRefs(value, meta, "style")
				);
				break;

			case "data":
				if (meta) {
					const obj = resolveInlineRefs(value, meta, "data");
					if (isObject(obj)) {
						setAttribute(node, "data", obj);
						break;
					}
				}
				
				setAttribute(node, key, value);
				break;
			
			default:
				if (key.indexOf("data-") == 0) {
					const ref = resolveInlineRefs(value, meta, "singleton"),
						k = casing(key).from.data.to.camel;

					if (ref && ref.isDynamicValue) {
						const value = ref.data;
						let resolver;

						if (typeof value == "function") {
							resolver = (...args) => ({
								[k]: value(...args)
							});
						} else {
							resolver = _ => ({
								[k]: value
							});
						}

						setAttribute(node, "data", mkDynamicValue({
							type: "tokenlist",
							joiner: joinDatasets,
							merger: extendDataset,
							staticTokens: mkDatasetList(),
							dynamicTokens: [resolver]
						}));
					} else {
						setAttribute(node, "data", {
							[k]: ref
						});
					}
				} else if (key.indexOf("on") == 0) {
					setAttribute(node, "events", {
						[key.substring(2)]: resolveInlineRefs(value, meta, "event")
					});
				} else
					setAttribute(node, key, resolveInlineRefs(value, meta, "singleton"));
		}
	}
}

function resolveInlineRefs(str, meta = null, context = "raw") {
	if (!meta || !meta.refKeys.length || typeof str != "string")
		return str;

	const preserveWhitespace = context == "raw",
		useTerms = context != "raw" || (meta.options.compile && !meta.options.resolve),
		wrapDynamic = context == "class" || context == "style" || context == "data",
		refRegex = meta.options.refRegex || REF_REGEX,
		terms = [],
		staticTerms = [],
		dynamicTerms = [];

	let out = "",
		ptr = 0,
		hasDynamicTerms = false;

	const push = term => {
		if (meta.options.compile) {
			if (meta.options.resolve || !isDynamicValueCandidate(term, meta)) {
				pushTerm(terms, term);
				pushTerm(staticTerms, term);
				out += serialize(term, meta.options);
			} else {
				if (wrapDynamic && typeof term != "function") {
					const rawTerm = term;
					term = _ => rawTerm;
				}

				terms.push(term);
				dynamicTerms.push(term);
				hasDynamicTerms = true;
			}
		} else if (typeof term == "string")
			out += term;
		else
			out += serialize(term, meta.options);
	};

	const pushTerm = (target, term) => {
		if (!useTerms || !term || (!preserveWhitespace && isEmptyString(term)))
			return;

		if (target.length && typeof term == "string" && typeof target[target.length - 1] == "string")
			target[target.length - 1] += term;
		else
			target.push(term);
	};

	while (true) {
		const ex = refRegex.exec(str);
		let chunk = "";

		if (ex && ex.index > ptr)
			chunk = str.substring(ptr, ex.index);
		else if (!ex && ptr < str.length)
			chunk = str.substring(ptr, str.length);

		push(chunk);

		if (!ex)
			break;

		const match = ex[0];

		if (!hasOwn(meta.refs, match))
			push(match);
		else
			push(meta.refs[match]);

		ptr = ex.index + match.length;
	}

	switch (context) {
		case "raw":
			if (!hasDynamicTerms)
				return useTerms ? terms[0] : out;

			return mkDynamicValue({
				type: "ordered",
				value: terms
			});

		case "singleton":
			if (!hasDynamicTerms)
				return useTerms ? terms[0] : out;

			return mkDynamicValue({
				type: "singleton",
				data: terms[0]
			});

		case "class":
			if (!hasDynamicTerms)
				return joinClassAsTokenList(...terms);

			return mkDynamicValue({
				type: "tokenlist",
				joiner: joinClassAsTokenList,
				merger: extendClass,
				staticTokens: joinClassAsTokenList(...staticTerms),
				dynamicTokens: dynamicTerms
			});

		case "style":
			if (!hasDynamicTerms)
				return joinStyle(...terms);

			return mkDynamicValue({
				type: "tokenlist",
				joiner: joinStyle,
				merger: extendStyle,
				staticTokens: joinStyle(...staticTerms),
				dynamicTokens: dynamicTerms
			});

		case "data":
			if (!hasDynamicTerms)
				return joinDatasets(...terms);

			return mkDynamicValue({
				type: "tokenlist",
				joiner: joinDatasets,
				merger: extendDataset,
				staticTokens: joinDatasets(...staticTerms),
				dynamicTokens: dynamicTerms
			});

		case "event":
			return terms[0];
	}

	return out;
}

// Legacy
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

export {
	// General
	hasAncestor,
	hasAncestorBySelector,
	mkAttrRepresentationObj,
	mkStyleList,
	mkDatasetList,
	mkTokenList,
	appendToken,
	removeToken,
	// Style
	parseStyle,
	parseStyleStr,
	joinStyle,
	joinStyleWithArgs,
	extendStyle,
	extendStyleWithArgs,
	// Classes
	parseClass,
	joinClass,
	joinClassAsArray,
	joinClassAsTokenList,
	joinClassWithArgs,
	joinClassAsArrayWithArgs,
	joinClassAsTokenListWithArgs,
	extendClass,
	extendClassWithArgs,
	// Datasets
	parseDataset,
	joinDatasets,
	extendDataset,
	// Events
	parseEvents,
	joinEvents,
	extendEvents,
	// Attribute processing
	joinAttributes,
	// Printing / rendering
	printClass,
	printStyle,
	genDom,
	serializeDom,
	// Information
	getTagProperties,
	getNodeType,
	// VDOM
	mkVNode,
	mkDynamicValue,
	extendDynamicValue,
	mergeDynamicValue,
	resolveDynamicValue,
	setAttribute,
	parseAttributes,
	resolveInlineRefs,
	// Legacy
	overrideAttributes,
	cleanAttributes
};
