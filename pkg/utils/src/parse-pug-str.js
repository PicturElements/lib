import filterMut from "./filter-mut";
import {
	mkVNode,
	parseDom,
	getTagProperties,
	setAttribute,
	setTextContent,
	parseAttributes,
	resolveAttribute,
	resolveInlineRefs,
	mkAttrRepresentationObj
} from "./dom";
import hasOwn from "./has-own";
import { optionize } from "./internal/options";

const ctx = resolveInlineRefs.ctx;

// Parses a subset of pug (no control flow)
export default function parsePugStr(...source) {
	return parseDom(
		parsePugCore,
		source,
		parsePugStr.extractOptions()
	);
}

optionize(parsePugStr, null, {
	compile: true,				// Compile inline values (${xyz}) as part of the template 
	resolve: true,				// Resolve getters at parse time
	render: {					// Compile and resolve, producing a static asset
		compile: true,
		resolve: true
	},
	lazy: true,					// cache templates (returns compiled object)
	compact: true,				// Serialize resolved values in compact mode (serializer hint)
	lazyDynamic: true,			// treat all inline values except functions as constants
	eagerDynamic: true,			// treat every inline value as a getter (caches, returns compiled object)
	rawResolve: true,			// resolve every inline value in raw form
	functionalTags: true,		// Treat tags as entry points for functional components
	singleContextArg: true,		// Use single context arguments in callbacks (serializer hint)
	preserveEntities: true,		// Preserve entity strings in their original form
	preserveNewlines: true,		// Preserve newlines surrounding text blocks
});

// Capturing groups:
// 1: indent
// 2: comment node
// 3: text node
// 4: tag name
// 5: tag data (class, id)
// 6: attribute data
// 7: string quote character
// 8: element content
// /([\t ]*)(?:\|\s?(.+)|([^#.\s]+)?([\w.#-]+)(?:\(((?:(["'`])(?:[^\\]|\\.)*?\6|[^"'`])+?)\))?)/g
// /([\t ]*)(?:\|\s?(.+)|([^#.\s]+)?([\w.#-]+)(?:\(((?:(["'`])(?:[^\\]|\\.)*?\6|[^"'`])*?)\))?[\t ]*(.*?)$)/gm
// /([\t ]*)(?:\/\/-.+|\|\s?(.+)|([^#.\s*(]+)?([\w.#-]*)(?:\(((?:(["'`])(?:[^\\]|\\.)*?\6|[^"'`])*?)\))?[\t ]?(.*?)$)/gm
const NODE_REGEX = /^([\t ]*)(?:\/\/-(.*(?:\n\1[\t ]+.+)*)|\|\s?(.+)|([^#.\s*(]+)?([\w.#-]*)(?:\(((?:(["'`])(?:[^\\]|\\.)*?\7|[^"'`])*?)\))?[\t ]?(.*?)$)/gm,
	CLASS_ID_REGEX = /([.#])([^.#]+)/g,
	WELL_FORMED_INDENT_REGEX = /^(\s)\1*$/;

function parsePugCore(str, meta = null) {
	const root = [],
		stack = [],
		options = (meta && meta.options) || {},
		mk = options.mkVNode || mkVNode;
	let lastNode = null,
		parent = null,
		target = root,
		indent = -1,
		indentChar = null,
		line = 0;

	NODE_REGEX.lastIndex = 0;

	while (true) {
		const ex = NODE_REGEX.exec(str);
		if (!ex)
			break;

		line++;

		if (!ex[0]) {
			NODE_REGEX.lastIndex++;
			continue;
		}

		if (!ex[0].trim())
			continue;

		let type;

		if (ex[2] != null)
			type = "comment";
		else if (ex[3])
			type = "text";
		else
			type = "element";

		const indentStr = ex[1],
			indentLen = indentStr.length,
			node = mk(type, {
				raw: ex[0],
				tag: ex[4]
			});

		node.tag = resolveInlineRefs(node.tag, meta, ctx(node, "tag")(
			options.functionalTags ? "literal" : "string")
		);

		if (typeof node.tag == "string") {
			const props = getTagProperties(node.tag);
			node.tag = props.tag;
			node.namespace = props.namespace;
			node.void = props.void;
		}

		if (indentStr && !WELL_FORMED_INDENT_REGEX.test(indentStr))
			throw new SyntaxError(`Malformed indent on line ${line}`);

		if (indentLen) {
			if (indentChar && indentStr[0] != indentChar)
				throw new SyntaxError(`Mixed indent on line ${line}`);

			if (indentChar)
				indentChar = indentStr[0];
		}

		if (indentLen > indent) {
			parent = lastNode ?
				lastNode :
				null;
			target = lastNode ?
				lastNode.children :
				root;
			indent = indentLen;

			stack.push({
				parent,
				target,
				indent
			});
		} else if (indentLen < indent) {
			while (stack.length && stack[stack.length - 1].indent > indentLen)
				stack.pop();

			if (!stack.length)
				throw new Error(`Fell out of struct stack on line ${line}`);

			({ parent, target, indent } = stack[stack.length - 1]);
		}

		switch (type) {
			case "comment":
				setTextContent(node, ex[2], meta);
				break;

			case "text":
				setTextContent(node, ex[3], meta);
				break;

			case "element": {
				node.children = [];
				node.attributes = mkAttrRepresentationObj();
				node.static = true;
				node.staticAttributes = [];
				node.dynamicAttributes = [];
				node.dynamicAttributesMap = {};
				node.tagData = ex[5] || null;
				node.attrData = ex[6] || null;

				parseClassesAndIDs(node, meta);
				parseAttributes(node, meta);
			
				if (node.dynamicAttributes.length)
					filterMut(node.staticAttributes, key => !hasOwn(node.dynamicAttributesMap, key));

				if (hasOwn(node.attributes, "xmlns")) {
					if (typeof node.attributes.xmlns == "string")
						node.namespace = node.attributes.xmlns;
					else if (options.compile && options.resolve)
						node.namespace = resolveAttribute(node, "xmlns", options.args);
				} else if (parent && parent.namespace != "http://www.w3.org/1999/xhtml")
					node.namespace = parent.namespace;

				const textContent = ex[8];

				if (!textContent)
					break;

				const textNode = mk("text", {
					raw: textContent,
					parent: node
				});

				setTextContent(textNode, textContent, meta);
				node.children.push(textNode);
				node.static = node.static && textNode.static;
				break;
			}
		}

		if (!node.static) {
			for (let i = stack.length - 1; i > 0; i--) {
				if (!stack[i].parent.static)
					break;

				stack[i].parent.static = false;
			}
		}

		lastNode = node;
		node.parent = parent;
		target.push(node);
	}

	return root;
}

function parseClassesAndIDs(node, meta = null) {
	if (!node.tagData)
		return;

	while (true) {
		const ex = CLASS_ID_REGEX.exec(node.tagData);
		if (!ex)
			break;

		switch (ex[1]) {
			case ".":
				if (meta) {
					setAttribute(
						node,
						"class",
						resolveInlineRefs(ex[2], meta, ctx(node, "attribute", "class")("raw"))
					);
				} else
					setAttribute(node, "class", ex[2]);
				break;

			case "#":
				setAttribute(
					node,
					"id",
					resolveInlineRefs(ex[2], meta, ctx(node, "attribute", "class")("raw"))
				);
				break;
		}
	}
}
