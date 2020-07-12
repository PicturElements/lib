import filterMut from "./filter-mut";
import {
	isObj,
	isTaggedTemplateArgs
} from "./is";
import { compileTaggedTemplate } from "./str";
import {
	mkVNode,
	setAttribute,
	parseAttributes,
	resolveInlineRefs,
	mkAttrRepresentationObj
} from "./dom";
import hasOwn from "./has-own";
import {
	composeOptionsTemplates,
	createOptionsObject
} from "./internal/options";

let TEMPLATE_CACHE = null;
const optionsTemplates = composeOptionsTemplates({
	compile: true,
	resolve: true,
	lazyDynamic: true,
	eagerDynamic: true,
	lazy: true,
	render: {
		compile: true,
		resolve: true
	}
});

// Parses a subset of pug (no control flow)
export default function parsePugStr(...args) {
	const isTagged = isTaggedTemplateArgs(args);

	if (isObj(args[0]) && !isTagged)
		return args[0];

	const options = compileTaggedTemplate.options;

	if (options && options.compile) {
		compileTaggedTemplate.with({
			ref: 16,
			refPrefix: "ref_",
			refSuffix: "",
			refRegex: /ref_[a-zA-Z0-9]{16}/g,
			resolveFunctions: true
		});

		if (options.eagerDynamic || options.lazy) {
			// This works because tagged template args are singletons
			// defined at parse time, effectively producing a unique ID
			// for every unique template
			if (!TEMPLATE_CACHE && typeof Map != "undefined")
				TEMPLATE_CACHE = new Map();
			window.TEMPLATE_CACHE = TEMPLATE_CACHE;

			if (options.lazy && isTagged && TEMPLATE_CACHE && TEMPLATE_CACHE.has(args[0])) {
				const d = TEMPLATE_CACHE.get(args[0]);
				for (let i = 0, l = d.argRefs.length; i < l; i++)
					d.argRefs[i].value = args[i + 1];
				return d;
			}

			const meta = compileTaggedTemplate(...args);
			meta.argRefs = [];
			const data = {
				meta,
				argRefs: meta.argRefs,
				dom: parsePugCore(meta.compiled, meta)
			};

			if (TEMPLATE_CACHE && isTagged)
				TEMPLATE_CACHE.set(args[0], data);

			return data;
		}

		const meta = compileTaggedTemplate(...args);
		return parsePugCore(meta.compiled, meta);
	}

	return parsePugCore(
		compileTaggedTemplate(...args),
		null
	);
}

parsePugStr.with = options => {
	options = createOptionsObject(options, optionsTemplates);
	compileTaggedTemplate.with(options);
	return parsePugStr;
};

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
			tag: resolveInlineRefs(ex[4], meta, "string")
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
