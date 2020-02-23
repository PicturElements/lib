import filterMut from "./filter-mut";
import parseStr from "./parse-str";
import casing from "./casing";
import {
	isObj,
	isTaggedTemplateArgs
} from "./is";
import { compileTaggedTemplate } from "./str";
import {
	cleanAttributes,
	getTagProperties
} from "./dom";

// Parses a subset of pug (no control flow)

export default function parsePugStr(...args) {
	if (isObj(args[0]) && !isTaggedTemplateArgs(args))
		return args[0];

	return parsePugCore(
		compileTaggedTemplate(...args)
	);
}

parsePugStr.with = options => {
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
const nodeRegex = /([\t ]*)(?:\/\/-(.*(?:\n\1[\t ]+.+)*)|\|\s?(.+)|([^#.\s*(]+)?([\w.#-]*)(?:\(((?:(["'`])(?:[^\\]|\\.)*?\7|[^"'`])*?)\))?[\t ]?(.*?)$)/gm,
	classIDRegex = /([.#])([^.#]+)/g;

// Capturing groups:
// 1: key
// 2: value
// 3: string quote character
const attributeSplitRegex = /([\w-.:]+)(?:\s*=\s*((["'`])(?:[^\\]|\\.)*?\3|[^"'`\s]+))?/g,
	wellFormedIndentRegex = /^(\s)\1*$/;

function parsePugCore(str) {
	const nodes = parseNodes(str || "");

	for (let i = 0, l = nodes.length; i < l; i++) {
		const node = nodes[i];

		switch (node.type) {
			case "element":
				parseClassesAndIDs(node);
				parseAttributes(node);
				cleanAttributes(node.attributes);
				break;
		}
	}

	createTrees(nodes);
	return nodes;
}

function parseNodes(str) {
	const nodes = [];

	while (true) {
		const ex = nodeRegex.exec(str);
		if (!ex)
			return nodes;

		if (!ex[0]) {
			nodeRegex.lastIndex++;
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

		const node = createNode(type, {
			raw: ex[0],
			indent: ex[1],
			tag: ex[4]
		});

		switch (type) {
			case "comment":
				Object.assign(node, {
					content: ex[2]
				});
				break;

			case "text":
				Object.assign(node, {
					content: ex[3] || null
				});
				break;

			case "element":
				Object.assign(node, {
					children: [],
					attributes: {
						class: [],
						data: {}
					},
					tagData: ex[5] || null,
					attrData: ex[6] || null
				});
	
				const elemContent = ex[8];

				if (!elemContent)
					break;

				node.children.push(
					createNode("text", {
						content: elemContent,
						raw: elemContent
					})
				);
				break;
		}

		nodes.push(node);
	}
}

const defaultTags = {
	comment: "#comment",
	text: "#text",
	element: "div"
};

function createNode(type, data) {
	const node = Object.assign({
		type,
		raw: "",
		indent: "",
		tag: null
	}, data);

	node.tag = node.tag || defaultTags[type];

	if (type == "element") {
		const props = getTagProperties(node.tag);
		node.tag = props.tag;
		node.namespace = props.namespace;
		node.void = props.void;
	}

	return node;
}

function parseClassesAndIDs(node) {
	if (!node.tagData)
		return;

	const attr = node.attributes;
	
	while (true) {
		const ex = classIDRegex.exec(node.tagData);
		if (!ex)
			break;

		switch (ex[1]) {
			case ".":
				attr.class.push(ex[2]);
				break;

			case "#":
				attr.id = ex[2];
				break;
		}
	}
}

function parseAttributes(node) {
	if (!node.attrData)
		return;

	const attr = node.attributes;
	
	while (true) {
		const ex = attributeSplitRegex.exec(node.attrData);
		if (!ex)
			break;

		const key = ex[1],
			value = ex[2] === undefined ? true : parseStr(ex[2]);

		switch (key) {
			case "class":
				attr.class = attr.class.concat(
					String(value).split(/\s+/g)
				);
				break;
			
			default:
				if (key.indexOf("data-") == 0)
					attr.data[casing(key).from.data.to.camel] = value;
				else
					attr[key] = value;
		}
	}
}

function createTrees(nodes) {
	if (!nodes.length)
		return nodes;

	const nodeLen = nodes.length;
	let indentChar = null;

	function walk(parent, idx) {
		const indent = nodes[idx].indent.length;
		let lastNode = null;

		for (idx; idx < nodeLen; idx++) {
			const node = nodes[idx],
				currIndent = node.indent.length;

			if (node.indent && !wellFormedIndentRegex.test(node.indent))
				throw new SyntaxError(`Malformed indent at '${node.raw}' (line ${idx})`);

			if (currIndent) {
				if (indentChar && node.indent[0] != indentChar)
					throw new SyntaxError(`Mixed indent at '${node.raw}'`);

				indentChar = indentChar || node.indent[0];
			}

			if (currIndent == indent && parent) {
				parent.children.push(node);
				nodes[idx] = null;
			} else if(currIndent > indent && lastNode)
				idx = walk(lastNode, idx, currIndent);
			else if (currIndent < indent)
				return idx - 1;

			lastNode = node;
		}

		return nodeLen;
	}

	walk(null, 0);
	filterMut(nodes, n => n !== null);
	return nodes;
}
