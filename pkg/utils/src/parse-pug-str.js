import filterMut from "./filter-mut";
import {
	mkVNode,
	parseDom,
	setAttribute,
	parseAttributes,
	resolveAttribute,
	resolveInlineRefs,
	mkAttrRepresentationObj
} from "./dom";
import hasOwn from "./has-own";
import {
	composeOptionsTemplates,
	createOptionsObject
} from "./internal/options";

const optionsTemplates = composeOptionsTemplates({
	compile: true,
	resolve: true,
	lazyDynamic: true,
	eagerDynamic: true,
	lazy: true,
	rawResolve: true,
	singleContextArg: true,
	compact: true,
	render: {
		compile: true,
		resolve: true
	}
});

// Parses a subset of pug (no control flow)
export default function parsePugStr(...source) {
	const options = parsePugStr._options;
	parsePugStr._options = null;
	return parseDom(parsePugCore, source, options);
}

parsePugStr.with = (options, override = true) => {
	options = createOptionsObject(options, optionsTemplates);

	if (!isObject(options))
		return parsePugStr;

	if (parsePugStr._options) {
		if (override)
			parsePugStr._options = Object.assign(parsePugStr._options, options);
		else
			parsePugStr._options = Object.assign({}, options, parsePugStr._options);
	} else
		parsePugStr._options = Object.assign({}, options);

	return parsePugStr;
};

parsePugStr._options = null;

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
	return parseNodes(str || "", meta);
}

function parseNodes(str, meta = null) {
	const root = [],
		stack = [];
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
			mk = meta && meta.options.mkVNode || mkVNode;

		const node = mk(type, {
			raw: ex[0],
			tag: resolveInlineRefs(ex[4], meta, "literal")
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
			case "comment": {
				const content = resolveInlineRefs(ex[2], meta);
				node.content = content;
				node.static = !content || !content.isDynamicValue;
				break;
			}

			case "text": {
				const content = resolveInlineRefs(ex[3] || null, meta);
				node.content = content;
				node.static = !content || !content.isDynamicValue;
				break;
			}

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
					else if (meta.options.compile && meta.options.resolve)
						node.namespace = resolveAttribute(node, "xmlns", meta.options.args);
				} else if (parent && parent.namespace != "http://www.w3.org/1999/xhtml")
					node.namespace = parent.namespace;

				const elemContent = ex[8];

				if (!elemContent)
					break;

				const content = resolveInlineRefs(elemContent, meta, "string"),
					isStatic = !content || !content.isDynamicValue;

				node.children.push(
					mk("text", {
						content,
						static: isStatic,
						raw: elemContent,
						parent: node
					})
				);
				node.static = node.static && isStatic;
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
						resolveInlineRefs(ex[2], meta, "class")
					);
				} else
					setAttribute(node, "class", ex[2]);
				break;

			case "#":
				setAttribute(
					node,
					"id",
					resolveInlineRefs(ex[2], meta)
				);
				break;
		}
	}
}
