import filterMut from "./filter-mut";
import {
	mkVNode,
	parseDom,
	getTagProperties,
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
	preserveEntities: true,
	preserveNewlines: true,
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
		mk = options.mkVNode || mkVNode,
		eData = {
			tag: null,
			selfClosing: false
		};
	let state = STATES.CONTENT,
		buffer = "",
		whitespaceBuffer = "",
		quote = null,
		hasContent = false,
		target = root,
		parent = null,
		i = 0,
		cutoffIdx = 0;

	const append = char => {
		if (options.trim) {
			if (isWhitespace(char)) {
				if (buffer)
					whitespaceBuffer += char;
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
		const prevNode = (target.length && target[target.length - 1]) || null,
			prevIsText = Boolean(prevNode) && prevNode.type == "text";

		if (prevIsText)
			buffer = prevNode.raw + str.substring(cutoffIdx, i);
		else if (state != STATES.CONTENT)
			buffer = str.substring(cutoffIdx, i) + buffer;
		else if (!hasContent) {
			clear();
			return;
		}

		cutoffIdx = i;

		const text = mk("text", {
			raw: buffer
		});
		setTextContent(text, buffer, meta);
		text.parent = parent;

		if (prevIsText)
			target[target.length - 1] = text;
		else
			target.push(text);

		state = STATES.CONTENT;
		clear();
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

		if (typeof node.tag == "string") {
			const props = getTagProperties(node.tag);
			node.tag = props.tag;
			node.namespace = props.namespace;
			node.void = props.void;
		}

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

		if (eData.selfClosing || node.void)
			eData.selfClosing = false;
		else {
			target = node.children;
			parent = node;
			stack.push(node);
		}

		cutoffIdx = i + 1;
		state = STATES.CONTENT;
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
		state = STATES.CONTENT;
		clear();
	};

	const clear = _ => {
		buffer = "";
		whitespaceBuffer = "";
		hasContent = false;
	};

	for (let l = str.length; i < l; i++) {
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
		
		if (state == STATES.ATTRIBUTES) {
			if (char == "\"" || char == "'" || char == "`") {
				if (!quote)
					quote = char;
				else if (quote == char)
					quote = null;

				append(char);
				continue;
			}

			if (!quote && char == "/") {
				eData.selfClosing = true;
				continue;
			}
			
			if (quote || (char != "<" && char != ">")) {
				append(char);
				continue;
			}
		}

		switch (char) {
			case "\\":
				if (i == l - 1)
					append(char);
				else {
					if (state == STATES.ATTRIBUTES)
						append("\\");

					append(str[i + 1]);
				}
				break;

			case "<":
				dispatch();
				if (str[i + 1] == "!" && str[i + 2] == "-" && str[i + 3] == "-") {
					state = STATES.COMMENT;
					i += 3;
				} else if (str[i + 1] == "/") {
					state = STATES.END_TAG;
					i++;
				} else {
					state = STATES.TAG;
					eData.selfClosing = false;
				}
				break;

			case ">":
				if (state == STATES.TAG && buffer)
					push(buffer, null);
				else if (state == STATES.ATTRIBUTES)
					push(eData.tag, buffer);
				else if (state == STATES.END_TAG)
					pop(buffer);
				else
					append(char);
				break;

			default:
				if (state == STATES.TAG) {
					if (isWhitespace(char) || char == "/") {
						if (buffer) {
							eData.tag = buffer;
							eData.selfClosing = char == "/";
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
