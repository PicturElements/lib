import { optionize } from "./internal/options";
import {
	isWhitespace,
	isQuote
} from "./is";
import {
	mkVNode,
	parseDom,
	addAttributeData,
	getTagProperties,
	setTextContent,
	parseAttributes,
	resolveAttribute,
	resolveInlineRefs
} from "./dom";
import { startsWith } from "./str";
import hasOwn from "./has-own";
import filterMut from "./filter-mut";

const ctx = resolveInlineRefs.ctx;

export default function parseHtmlStr(...source) {
	return parseDom(
		parseHtmlCore,
		source,
		parseHtmlStr.extractOptions()
	);
}

optionize(parseHtmlStr, {
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
	eagerTemplates: true,		// Treat any inline reference as a template
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
	const options = (meta && meta.options) || {},
		mk = options.mkVNode || mkVNode,
		root = mk("fragment", {
			raw: str,
			children: [],
			static: true
		}),
		stack = [root],
		eData = {
			tag: null,
			selfClosing: false
		},
		refData = {
			positions: meta && meta.refPositions,
			ptr: -1
		};
	let parent = root,
		target = root.children,
		// states
		state = STATES.CONTENT,
		buffer = "",
		whitespaceBuffer = "",
		quote = null,
		contentQuote = null,
		strictContent = false,
		hasContent = false,
		cutoffIdx = 0,
		ptr = 0;

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
		contentQuote = null;
		strictContent = false;
	};

	const pushText = _ => {
		const prevNode = (target.length && target[target.length - 1]) || null,
			prevIsText = Boolean(prevNode) && prevNode.type == "text",
			requiresTrim = prevIsText || state != STATES.CONTENT;

		if (prevIsText)
			buffer = prevNode.raw + str.substring(cutoffIdx, ptr);
		else if (state != STATES.CONTENT)
			buffer = str.substring(cutoffIdx, ptr) + buffer;
		else if (!hasContent) {
			clear();
			return;
		}

		cutoffIdx = ptr;

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

	const pushElem = (tag, attrData) => {
		const node = addAttributeData(
			mk("element", {
				raw: tag,
				parent,
				children: [],
				static: true,
				tagData: tag,
				attrData: attrData
			})
		);

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
		} else if (parent.namespace && parent.namespace != "http://www.w3.org/1999/xhtml")
			node.namespace = parent.namespace;

		target.push(node);

		const selfCloses = eData.selfClosing || node.void;

		if (selfCloses)
			eData.selfClosing = false;
		else {
			target = node.children;
			parent = node;
			stack.push(node);
		}

		cutoffIdx = ptr + 1;
		state = STATES.CONTENT;
		propagate(node);
		clear();

		if (!selfCloses) {
			if (parent.tag == "script" || parent.tag == "style")
				strictContent = true;
		}
	};

	const pushTemplate = _ => {
		const key = meta.refKeys[refData.ptr],
			template = addAttributeData(
				mk("template", {
					raw: "",
					parent,
					commonChildren: [],
					tag: "#template",
					static: false
				})
			);

		template.children = resolveInlineRefs(
			key,
			meta,
			ctx(template, "children")("literal")
		);

		target.push(template);
		ptr += (key.length - 1);
		cutoffIdx = ptr + 1;
		state = STATES.CONTENT;
		propagate(template);
		clear();
	};

	const pop = tagName => {
		while (stack.length > 1) {
			const node = stack.pop();
			if (!node || !tagName || node.tag == tagName || typeof node.tag != "string")
				break;
		}

		parent = stack[stack.length - 1];
		target = parent.children;
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

	for (let l = str.length; ptr < l; ptr++) {
		const char = str[ptr];

		if (refData.positions && refData.positions[refData.ptr + 1] == ptr)
			refData.ptr++;

		if (state == STATES.COMMENT) {
			if (char != "-" || str[ptr + 1] != "-" || str[ptr + 2] != ">")
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
				ptr += 2;
			}

			continue;
		}
		
		if (state == STATES.ATTRIBUTES) {
			if (isQuote(char)) {
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

		if (state == STATES.CONTENT && strictContent) {
			if (char == "<" && str[ptr + 1] == "/" && startsWith(str, parent.tag + ">", ptr + 2))
				strictContent = false;
			else if (isQuote(char)) {
				if (contentQuote) {
					if (char == contentQuote)
						contentQuote = null;
				} else
					contentQuote = char;

				append(char);
				continue;
			} else {
				append(char);
				continue;
			}
		}

		switch (char) {
			case "\\":
				if (ptr == l - 1)
					append(char);
				else {
					if (state == STATES.ATTRIBUTES)
						append("\\");

					append(str[ptr + 1]);
					ptr++;
				}
				break;

			case "<":
				pushText();
				if (str[ptr + 1] == "!" && str[ptr + 2] == "-" && str[ptr + 3] == "-") {
					state = STATES.COMMENT;
					ptr += 3;
				} else if (str[ptr + 1] == "/") {
					state = STATES.END_TAG;
					ptr++;
				} else {
					state = STATES.TAG;
					eData.selfClosing = false;
				}
				break;

			case ">":
				if (state == STATES.TAG && buffer)
					pushElem(buffer, null);
				else if (state == STATES.ATTRIBUTES)
					pushElem(eData.tag, buffer);
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
				} else {
					if (refData.ptr > -1 && refData.positions[refData.ptr] == ptr) {
						const ref = meta.refList[refData.ptr];

						if (options.eagerTemplates || (ref && (ref.isParsedDom || ref.isCompiledDomData)) || (options.functionalTags && typeof ref == "function")) {
							pushText();
							pushTemplate();
						} else
							append(char);
					} else
						append(char);
				}
		}
	}

	pushText();

	if (root.children.length == 1) {
		const child = root.children[0];
		child.parent = null;
		child.isParsedDom = true;
		return child;
	}

	root.isParsedDom = true;
	return root;
}
