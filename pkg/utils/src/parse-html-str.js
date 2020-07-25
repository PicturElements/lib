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
	compile: true,				// Compile inline values (${xyz}) as part of the template 
	resolve: true,				// Resolve getters at parse time
	render: {					// Compile and resolve, producing a static asset
		compile: true,
		resolve: true
	},
	lazy: true,					// cache templates (returns compiled object)
	compact: true,				// Serialize resolved values in compact mode (serializer hint)
	permissive: true,			// Parses HTML with additional, more lenient syntax
	lazyDynamic: true,			// treat all inline values except functions as constants
	eagerDynamic: true,			// treat every inline value as a getter (caches, returns compiled object)
	rawResolve: true,			// resolve every inline value in raw form
	functionalTags: true,		// Treat tags as entry points for functional components
	singleContextArg: true,		// Use single context arguments in callbacks (serializer hint)
	preserveEntities: true,		// Preserve entity strings in their original form
	preserveNewlines: true,		// Preserve newlines surrounding text blocks
	trimWhitespace: true		// Trim whitespace surrounding text blocks
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
		if (options.trimWhitespace) {
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

	const clear = _ => {
		buffer = "";
		whitespaceBuffer = "";
		hasContent = false;
	};

	const dispatch = _ => {
		const prevNode = (target.length && target[target.length - 1]) || null,
			prevIsText = Boolean(prevNode) && prevNode.type == "text",
			requiresTrim = prevIsText || state != STATES.CONTENT;

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
		setTextContent(
			text,
			requiresTrim && options.trimWhitespace ?
				buffer.trim() :
				buffer,
			meta
		);
		text.parent = parent;

		if (prevIsText)
			target[target.length - 1] = text;
		else
			target.push(text);

		state = STATES.CONTENT;
		propagate(text);
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

		node.tag = resolveInlineRefs(tag, meta, ctx(node, "tag")(
			options.functionalTags ? "literal" : "string")
		);

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
		propagate(node);
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

	const propagate = node => {
		if (node.static)
			return;

		for (let i = stack.length - 1; i >= 0; i--) {
			if (!stack[i].static)
				break;

			stack[i].static = false;
		}
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
			
			if (quote || (char != ">" && (!options.permissive || char != "<"))) {
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
				else {
					state = STATES.CONTENT;
					append(char);
				}
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
