import {
	getTime,
	resolveVal,
	hasAncestor,
	requestFrame
} from "@qtxr/utils";
import Input from "./input";

const VNODE_ID_ATTR = "data-v-node-id";

export default class Formatted extends Input {
	constructor(name, options, form) {
		super(name, options, form, {
			formatters: Array,
			allowFormattedPaste: "boolean|function"
		});

		this.selection = null;
		this.debounce = {
			paste: false
		};
	}

	updateSelectionData(root) {
		const selection = window.getSelection();

		if (!hasAncestor(selection.anchorNode, root))
			return null;

		this.selection = getSelectionData(selection, root, this.selection);
		console.log(this.selection);
	}

	catchPaste(root) {
		if (this.debounce.paste)
			return;

		this.updateSelectionData(root);
		this.debounce.paste = true;
		root.innerHTML = "";

		requestFrame(_ => {
			stripAttributesDeep(root, VNODE_ID_ATTR, 1);

			const selection = window.getSelection(),
				selectionData = getSelectionData(selection, root);

			if (resolveVal(this.allowFormattedPaste, this, selectionData))
				injectVDom(this.selection, selectionData.vDom);
			else
				injectVDom(this.selection, selectionData.text);

			this.debounce.paste = false;
		});
	}

	render(root, selectionData) {

	}
}

function getSelectionData(selection, root, previousData) {
	const prevNodeMap = (previousData && previousData.vNodeMap) || {},
		nextNodeMap = {},
		vDom = resolveVNode(root, prevNodeMap, nextNodeMap),
		startTime = getTime();
	let idx = 0,
		selectionStart = -1,
		selectionEnd = -1,
		inSelection = false,
		text = "",
		selectedText = "";

	const traverse = (node, parentNode) => {
		const children = node.childNodes;

		for (let i = 0, l = children.length; i < l; i++) {
			switch (children[i].nodeType) {
				case Node.ELEMENT_NODE: {
					const vNode = resolveVNode(children[i], prevNodeMap, nextNodeMap);
					vNode.idx = idx;
					parentNode.children.push(vNode);
					vNode.children = [];
					traverse(children[i], vNode);
					break;
				}

				case Node.TEXT_NODE: {
					const textNode = children[i],
						txt = textNode.nodeValue,
						isAnchor = selection.anchorNode == textNode,
						isFocus = selection.focusNode == textNode,
						aOffs = selection.anchorOffset,
						fOffs = selection.focusOffset;

					if (isAnchor && isFocus) {
						selectionStart = idx + aOffs;
						selectionEnd = idx + fOffs;
						selectedText = txt.substr(aOffs, fOffs - aOffs);
					} else if (isAnchor) {
						inSelection = true;
						selectionStart = idx + selection.anchorOffset;
						selectedText += txt.substr(aOffs);
					} else if (isFocus) {
						inSelection = false;
						selectionEnd = idx + selection.focusOffset;
						selectedText += txt.substr(0, fOffs);
					} else if (inSelection)
						selectedText += txt;

					const prevIdx = parentNode.children.length - 1,
						prevChild = parentNode.children[prevIdx];

					if (typeof prevChild == "string")
						parentNode.children[prevIdx] += txt;
					else
						parentNode.children.push(txt);

					text += txt;
					idx += txt.length;
				}
			}
		}
	};

	vDom.children = [];
	traverse(root, vDom);

	return {
		selectionStart,
		selectionEnd,
		text,
		selectedText,
		selection,
		vDom,
		nodeMap: nextNodeMap,
		type: selection.type.toLowerCase(),
		parseTime: getTime() - startTime
	};
}

let nodeId = 0;

function resolveVNode(node, nodeMap, nextNodeMap) {
	const id = node.getAttribute(VNODE_ID_ATTR),
		mappedNode = id ? null : nodeMap[id];

	if (mappedNode) {
		nextNodeMap[mappedNode.id] = mappedNode;
		return mappedNode;
	}

	nextNodeMap[nodeId] = {
		id: nodeId,
		children: [],
		tag: node.localName
	};

	return nextNodeMap[nodeId++];
}

// vNodeOrText may be one of the following:
// string:	injects a string
// vNode:	injects the vNode into the selectionData's vDom
function injectVDom(selectionData, vNodeOrText) {
	console.log(vNodeOrText);
}

function stripAttributesDeep(node, attr, skipLevels = 0) {
	const strip = (n, lvl) => {
		if (n.nodeType != Node.ELEMENT_NODE)
			return;

		if (lvl >= skipLevels)
			n.removeAttribute(attr);

		const children = n.childNodes;

		for (let i = 0, l = children.length; i < l; i++)
			strip(children[i], lvl + 1);
	};

	strip(node, 0);
}
