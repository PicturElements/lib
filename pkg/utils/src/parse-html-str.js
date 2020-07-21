import filterMut from "./filter-mut";
import {
	mkVNode,
	parseDom,
	setTextContent,
	parseAttributes,
	resolveAttribute,
	resolveInlineRefs,
	mkAttrRepresentationObj
} from "./dom";
import hasOwn from "./has-own";
import { optionize } from "./internal/options";
import { isWhitespace } from "./is";

const ctx = resolveInlineRefs.ctx;

// Parses a subset of pug (no control flow)
export default function parseHtmlStr(...source) {
	return parseDom(
		parseHtmlCore,
		source,
		parseHtmlStr.extractOptions()
	);
}

optionize(parseHtmlStr, null, {
	compile: true,
	resolve: true,
	render: {
		compile: true,
		resolve: true
	},
	lazyDynamic: true,
	eagerDynamic: true,
	lazy: true,
	rawResolve: true,
	singleContextArg: true,
	compact: true,
	trim: true
});

const STATES = {
	CONTENT: 0,
	TAG: 1,
	ATTRIBUTES: 2,
	END_TAG: 3,
	COMMENT: 4
};

function parseHtmlCore(str, meta = null) {
	const root = [],
		stack = [],
		options = (meta && meta.options) || {},
		mk = options.mkVNode || mkVNode;
	let state = STATES.CONTENT,
		buffer = "",
		whitespaceBuffer = "",
		backupWhitespaceBuffer = "",
		hasContent = false,
		tag = null,
		target = root,
		parent = null;

	const append = char => {
		if (options.trim) {
			if (isWhitespace(char)) {
				if (buffer)
					whitespaceBuffer += char;
				backupWhitespaceBuffer += char;
			} else {
				if (whitespaceBuffer) {
					buffer += whitespaceBuffer;
					whitespaceBuffer = "";
				}

				buffer += char;
				hasContent = true;
			}
		} else {
			if (!hasContent && !isWhitespace(char))
				hasContent = true;

			buffer += char;
		}
	};

	const dispatch = _ => {
		if (!hasContent) {
			clear();
			return;
		}

		const text = mk("text", {
			raw: buffer
		});
		setTextContent(text, buffer, meta);
		clear();
		text.parent = parent;
		target.push(text);
		state = STATES.CONTENT;
	};

	const push = (tag, attrData) => {
		const node = mk("element", {
			raw: tag,
			parent,
			children: [],
			attributes: mkAttrRepresentationObj(),
			static: true,
			staticAttributes: [],
			dynamicAttributes: [],
			dynamicAttributesMap: {},
			attrData: attrData
		});

		node.tag = resolveInlineRefs(tag, meta, ctx(node, "tag")("literal"));
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

		target.push(node);
		target = node.children;
		parent = node;
		stack.push(node);
		clear();
	};

	const pop = tagName => {
		while (true) {
			const node = stack.pop();
			if (!node || !tagName || node.tag == tagName || typeof node.tag != "string")
				break;
		}

		parent = stack[stack.length - 1] || null;
		target = parent ?
			parent.children :
			root;
		clear();
	};

	const clear = _ => {
		buffer = "";
		whitespaceBuffer = "";
		hasContent = false;
	};

	for (let i = 0, l = str.length; i < l; i++) {
		const char = str[i];

		if (state == STATES.COMMENT) {
			if (char != "-" || str[i + 1] != "-" || str[i + 2] != ">")
				append(char);
			else {
				const comment = mk("comment", {
					raw: buffer
				});
				setTextContent(comment, buffer, meta);
				clear();
				comment.parent = parent;
				target.push(comment);
				state = STATES.CONTENT;
				i += 2;
			}

			continue;
		}

		switch (char) {
			case "\\":
				if (i == l - 1)
					append(char);
				else
					append(str[i + 1]);
				break;

			case "<":
				dispatch();
				if (str[i + 1] == "!" && str[i + 2] == "-" && str[i + 3] == "-") {
					state = STATES.COMMENT;
					i += 3;
				} else if (str[i + 1] == "/") {
					state = STATES.END_TAG;
					i++;
				} else
					state = STATES.TAG;
				break;

			case ">":
				if (state == STATES.TAG)
					push(buffer, null);
				else if (state == STATES.ATTRIBUTES)
					push(tag, buffer);
				else if (state == STATES.END_TAG)
					pop(buffer);
				else
					append(char);
				break;

			default:
				if (state == STATES.TAG) {
					if (isWhitespace(char)) {
						if (buffer) {
							tag = buffer;
							clear();
							state = STATES.ATTRIBUTES;
						} else
							state = STATES.CONTENT;
					} else
						append(char);
				} else
					append(char);
		}
	}

	dispatch();
	return root;
}
