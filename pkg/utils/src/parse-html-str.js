import { optionize } from "./internal/options";
import {
	mkVNode,
	parseDom,
	getNodeTarget,
	matchDirective,
	applyDirective,
	addAttributeData,
	getTagProperties,
	setTextContent,
	parseAttributes,
	resolveAttribute,
	sanitizeAttributes,
	resolveInlineRefs
} from "./dom";
import {
	isWhitespace,
	isQuote
} from "./is";
import { startsWith } from "./string";
import hasOwn from "./has-own";

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
	terminalProps: true,		// Don't pass undeclared props from parent to child
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
			meta,
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
	let lastNode = null,
		parent = root,
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
		ptr = 0,
		withinShallowDirective = false,
		addedChild = false;

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

		return buffer;
	};

	const appendResolveDirectives = char => {
		const dir = matchDirective(str, ptr);
		if (!dir) {
			append(char);
			return;
		}

		pushText();

		const targetNode = withinShallowDirective || addedChild ?
			parent :
			lastNode;

		const directive = applyDirective(
			dir,
			mk,
			targetNode,
			meta, msg => `${msg} (${dir})`
		);

		if (directive && withinShallowDirective && addedChild)
			pop();

		withinShallowDirective = true;
		addedChild = false;

		ptr += dir.length;

		for (let i = ptr + 1, l = str.length; i < l; i++) {
			if (str[i] == "{") {
				withinShallowDirective = false;
				ptr = i + 1;
				break;
			}

			if (!isWhitespace(str[i]))
				break;
		}

		cutoffIdx = ptr;

		if (directive) {
			directive.parent = parent;
			target.push(directive);

			lastNode = directive;
			parent = directive;
			stack.push(directive);
			target = getNodeTarget(directive);
		} else
			target = getNodeTarget(targetNode);
	};

	const clear = _ => {
		buffer = "";
		whitespaceBuffer = "";
		hasContent = false;
		contentQuote = null;
		strictContent = false;
	};

	const pushText = _ => {
		const prevNode = (target && target.length && target[target.length - 1]) || null,
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
			meta,
			parent,
			raw: buffer
		});
		setTextContent(
			text,
			requiresTrim && options.trimWhitespace ?
				buffer.trim() :
				buffer,
			meta
		);

		if (prevIsText)
			target[target.length - 1] = text;
		else
			target.push(text);

		finishMount(text);
	};

	const pushElem = (tag, attrData) => {
		const node = addAttributeData(
			mk("element", {
				meta,
				raw: tag,
				parent,
				children: [],
				static: true,
				tagData: tag,
				attrData: attrData
			})
		);

		prepareMount(node);

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
		sanitizeAttributes(node);

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
			target = getNodeTarget(node);
			parent = node;
			push(node);
		}

		cutoffIdx = ptr + 1;
		finishMount(node);

		if (!selfCloses) {
			if (parent.tag == "script" || parent.tag == "style")
				strictContent = true;
		}

		return node;
	};

	const pushTemplate = (tag, attrData) => {
		const template = addAttributeData(
			mk("template", {
				meta,
				raw: "",
				parent,
				commonChildren: [],
				tag: "#template",
				static: false,
				tagData: tag,
				attrData,
				cache: {
					props: null,
					attributes: null
				},
				metaOverride: null
			})
		);

		prepareMount(template);
		parseAttributes(template, meta);
		sanitizeAttributes(template);

		template.children = resolveInlineRefs(
			tag,
			meta,
			ctx(template, "children")("literal")
		);
		
		target.push(template);

		if (eData.selfClosing)
			eData.selfClosing = false;
		else {
			target = getNodeTarget(template);
			parent = template;
			push(template);
		}

		cutoffIdx = ptr + 1;
		finishMount(template);

		return template;
	};

	const pushInlineTemplate = _ => {
		const key = meta.refKeys[refData.ptr],
			template = addAttributeData(
				mk("template", {
					meta,
					raw: "",
					parent,
					commonChildren: [],
					tag: "#template",
					static: false,
					tagData: null,
					attrData: null,
					cache: {
						props: null,
						attributes: null
					},
					metaOverride: null
				})
			);

		prepareMount(template);

		template.children = resolveInlineRefs(
			key,
			meta,
			ctx(template, "children")("literal")
		);

		target.push(template);
		ptr += (key.length - 1);
		cutoffIdx = ptr + 1;
		finishMount(template);

		return template;
	};

	const push = node => {
		stack.push(node);
		node.withinShallowDirective = withinShallowDirective;
		node.addedChild = addedChild;
		withinShallowDirective = false;
		addedChild = false;
	};

	const pop = (tagNameOrCount = 1) => {
		if (typeof tagNameOrCount == "number") {
			let count = tagNameOrCount;

			while (stack.length > 1) {
				const node = stack.pop();
				lastNode = node;

				withinShallowDirective = node.withinShallowDirective;
				addedChild = node.addedChild;
				delete node.withinShallowDirective;
				delete node.addedChild;

				if (!node || --count <= 0)
					break;
			}
		} else {
			while (stack.length > 1) {
				const node = stack.pop();
				lastNode = node;

				withinShallowDirective = node.withinShallowDirective;
				addedChild = node.addedChild;
				delete node.withinShallowDirective;
				delete node.addedChild;

				if (!node || !tagNameOrCount || node.tag == tagNameOrCount || typeof node.tag != "string")
					break;
			}
		}

		parent = stack[stack.length - 1];
		target = getNodeTarget(parent);
		state = STATES.CONTENT;
		clear();
	};

	const prepareMount = node => {
		if (withinShallowDirective && addedChild) {
			withinShallowDirective = false;
			pop();
		}
	};

	const finishMount = node => {
		lastNode = node;
		state = STATES.CONTENT;
		propagate(node);
		clear();

		addedChild = true;
		if (hasOwn(node, "addedChild"))
			node.addedChild = true;
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

	const isTemplateRef = key => {
		if (!meta.refs || !hasOwn(meta.refs, key))
			return false;

		const ref = meta.refs[key];

		return options.eagerTemplates ||
			(ref && (ref.isParsedDom || ref.isCompiledDomData)) ||
			(options.functionalTags && typeof ref == "function");
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
					meta,
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
				if ((state == STATES.TAG || state == STATES.ATTRIBUTES) && isTemplateRef(eData.tag))
					pushTemplate(eData.tag, state == STATES.TAG ? "" : buffer);
				else if (state == STATES.TAG && buffer)
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

			case "}":
				if (withinShallowDirective && addedChild) {
					withinShallowDirective = false;
					pop();
				} else if (!parent || parent.type != "directive" || withinShallowDirective)
					append(char);
				break;

			default:
				if (state == STATES.TAG) {
					if (isWhitespace(char) || char == "/") {
						if (buffer) {
							eData.selfClosing = char == "/";
							clear();
							state = STATES.ATTRIBUTES;
						} else
							state = STATES.CONTENT;
					} else
						eData.tag = append(char);
				} else {
					if (refData.ptr > -1 && refData.positions[refData.ptr] == ptr) {
						if (isTemplateRef(meta.refKeys[refData.ptr])) {
							pushText();
							pushInlineTemplate();
						} else
							append(char);
					} else
						appendResolveDirectives(char);
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
