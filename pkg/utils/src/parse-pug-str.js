import { optionize } from "./internal/options";
import {
	mkVNode,
	parseDom,
	addAttributeData,
	getTagProperties,
	setAttribute,
	getNodeTarget,
	setTextContent,
	applyDirective,
	parseAttributes,
	resolveAttribute,
	sanitizeAttributes,
	resolveInlineRefs
} from "./dom";
import hasOwn from "./has-own";
import filterMut from "./filter-mut";

const ctx = resolveInlineRefs.ctx;

export default function parsePugStr(...source) {
	return parseDom(
		parsePugCore,
		source,
		parsePugStr.extractOptions()
	);
}

optionize(parsePugStr, {
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
	terminalProps: true,		// Don't pass undeclared props from parent to child
	functionalTags: true,		// Treat tags as entry points for functional components
	eagerTemplates: true,		// Treat any inline reference as a template
	singleContextArg: true,		// Use single context arguments in callbacks (serializer hint)
	preserveEntities: true,		// Preserve entity strings in their original form
	preserveNewlines: true		// Preserve newlines surrounding text blocks
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
// /^([\t ]*)(?:\/\/-(.*(?:\n\1[\t ]+.+)*)|\|\s?(.+)|([^#.\s*(]+)?([\w.#-]*)(?:\(((?:(["'`])(?:[^\\]|\\.)*?\7|[^"'`])*?)\))?[\t ]?(.*?)$)/gm
const NODE_REGEX = /^([\t ]*)((?:if|else|elif|switch|case|default|each)[^:\n\r\v]*(?::|[\t ]*$)[\t ]*)?(?:\/\/-(.*(?:\n\2[\t ]+.+)*)|\|\s?([^\n]+)|([^#.\s*(]+)?([\w.#-]*)(?:\(((?:(["'`])(?:[^\\]|\\.)*?\8|[^"'`])*?)\))?[\t ]?(.*?)$)/gm,
	CLASS_ID_REGEX = /([.#])([^.#]+)/g,
	WELL_FORMED_INDENT_REGEX = /^(\s)\1*$/;

function parsePugCore(str, meta = null) {
	const options = (meta && meta.options) || {},
		mk = options.mkVNode || mkVNode,
		root = mk("fragment", {
			meta,
			raw: str,
			children: [],
			static: true
		}),
		stack = [{
			parent: root,
			indent: -1
		}],
		refData = {
			positions: meta && meta.refPositions,
			ptr: 0
		};
	let lastNode = null,
		parent = root,
		target = root.children,
		// states
		indent = -1,
		indentChar = null,
		line = 0,
		withinCompactDirective = false;

	NODE_REGEX.lastIndex = 0;

	while (true) {
		const ex = NODE_REGEX.exec(str);
		if (!ex)
			break;

		line++;

		if (refData.positions) {
			while (refData.ptr < refData.positions.length && ex.index > refData.positions[refData.ptr])
				refData.ptr++;
		}

		if (!ex[0]) {
			NODE_REGEX.lastIndex++;
			continue;
		}

		if (!ex[0].trim())
			continue;

		const valueIdx = ex[1].length + (ex[2] || "").length;
		let type;

		if (options.eagerTemplates && refData.positions[refData.ptr] == ex.index + valueIdx)
			type = "template";
		else if (ex[3] != null)
			type = "comment";
		else if (ex[4])
			type = "text";
		else if (!ex[5] && !ex[6] && !ex[7] && !ex[9])
			type = "none";
		else
			type = "element";

		const indentStr = ex[1],
			indentLen = indentStr.length,
			node = mk(type, {
				meta,
				raw: ex[0],
				tag: ex[5],
				static: true
			});

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
				root;

			target = getNodeTarget(parent);
			indent = indentLen;

			stack.push({
				parent,
				indent
			});
		} else if (indentLen < indent) {
			while (stack.length && stack[stack.length - 1].indent > indentLen)
				lastNode = stack.pop().parent;

			if (stack.length < 2)
				throw new Error(`Fell out of struct stack on line ${line}`);

			({ parent, indent } = stack[stack.length - 1]);
			target = getNodeTarget(parent);
			withinCompactDirective = false;
		}

		if (ex[2]) {
			const stripped = ex[2].replace(/:\s*$/, "");

			const directive = applyDirective(
				stripped,
				mk,
				lastNode,
				meta, msg => `${msg} on line ${line}`
			);

			withinCompactDirective = ex[2] != stripped;

			if (directive) {
				directive.parent = parent;
				target.push(directive);

				lastNode = directive;
				parent = directive;
				indent = indentLen;
			}
			
			if (withinCompactDirective)
				target = getNodeTarget(lastNode);
		} else if (withinCompactDirective && lastNode && lastNode.type == "directive" && indent >= stack[stack.length - 1].indent) {
			lastNode = stack.pop().parent;
			({ parent, indent } = stack[stack.length - 1]);
			target = getNodeTarget(parent);
			withinCompactDirective = false;
		}

		switch (type) {
			case "comment":
				setTextContent(node, ex[3], meta);
				break;

			case "text":
				setTextContent(node, ex[4], meta);
				break;

			case "template":
				node.children = [];
				node.commonChildren = [];
				node.tagData = ex[6] || null;
				node.attrData = ex[7] || null;
				node.static = false;
				node.cache = {
					props: null,
					attributes: null
				};
				node.metaOverride = null;

				addAttributeData(node);
				parseClassesAndIds(node, meta);
				parseAttributes(node, meta);
				sanitizeAttributes(node);

				node.children = resolveInlineRefs(
					node.tag,
					meta,
					ctx(node, "children")("literal")
				);

				node.tag = "#template";
				break;

			case "element": {
				node.children = [];
				node.tagData = ex[6] || null;
				node.attrData = ex[7] || null;
				addAttributeData(node);

				node.tag = resolveInlineRefs(node.tag, meta, ctx(node, "tag")(
					options.functionalTags ? "literal" : "string")
				);
		
				if (typeof node.tag == "string") {
					const props = getTagProperties(node.tag);
					node.tag = props.tag;
					node.namespace = props.namespace;
					node.void = props.void;
				}

				parseClassesAndIds(node, meta);
				parseAttributes(node, meta);
				sanitizeAttributes(node);
			
				if (node.dynamicAttributes.length)
					filterMut(node.staticAttributes, key => !hasOwn(node.dynamicAttributesMap, key));

				if (hasOwn(node.attributes, "xmlns")) {
					if (typeof node.attributes.xmlns == "string")
						node.namespace = node.attributes.xmlns;
					else if (options.compile && options.resolve)
						node.namespace = resolveAttribute(node, "xmlns", options.args);
				} else if (parent.namespace && parent.namespace != "http://www.w3.org/1999/xhtml")
					node.namespace = parent.namespace;

				const textContent = ex[9];

				if (!textContent)
					break;

				const textNode = mk("text", {
					meta,
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

		if (node.type != "none") {
			lastNode = node;
			node.parent = parent;
			target.push(node);
		}

		if (withinCompactDirective)
			lastNode = parent;
	}

	if (root.children.length == 1) {
		const child = root.children[0];
		child.parent = null;
		child.isParsedDom = true;
		return child;
	}

	root.isParsedDom = true;
	return root;
}

function parseClassesAndIds(node, meta = null) {
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
						resolveInlineRefs(ex[2], meta, ctx(node, "attribute", "class"))
					);
				} else
					setAttribute(node, "class", ex[2]);
				break;

			case "#":
				setAttribute(
					node,
					"id",
					resolveInlineRefs(ex[2], meta, ctx(node, "attribute", "id")("literal"))
				);
				break;
		}
	}
}
