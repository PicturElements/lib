import {
	hasOwn,
	inject,
	trimStr
} from "@qtxr/utils";

import { node } from "../utils";

const stringIdentFullRegex = /^"(?:[^\\"]*(?:\\.)?)*"|'(?:[^\\']*(?:\\.)?)*'$/g,
	attrRegex = /\[(?:[^"'[\]\\]*(?:'[^'\\]*(?:\\.[^'\\]*)*'|"[^"\\]*(?:\\.[^"\\]*)*")?|\\.)*\]/,
	attrPropRegex = /((?:[^\\=]*(?:\\.)?)*)=/,
	nameRegex = /^([a-z-]+):\s*/i,
	tagRegex = /^[a-z-]+/i,
	idClsRegex = /([.#])([^.#]+)/;

const VOID_TAGS = { area: 1, base: 1, br: 1, col: 1, embed: 1, hr: 1, img: 1, input: 1, link: 1, meta: 1, param: 1, source: 1, track: 1, wbr: 1 };

function parseElemStr(str) {
	let out = {
		name: null,
		tag: "div",
		class: [],
		attr: {}
	};

	// Get attributes
	const attrs = extractAttrs(str);
	out.attr = attrs.attrs;
	str = attrs.remainder;

	// Get name
	const nameMatch = nameRegex.exec(str);
	if (nameMatch)
		out.name = nameMatch[1];
	str = str.replace(nameRegex, "");

	// Get tag
	const tagMatch = tagRegex.exec(str);
	if (tagMatch)
		out.tag = tagMatch[0];
	str = str.replace(tagRegex, "");

	// Get classes and ID
	while (true) {
		const ex = idClsRegex.exec(str);
		if (!ex)
			break;

		if (ex[1] == ".")
			out.class.push(ex[2]);
		else
			out.attr.id = ex[2];

		str = str.replace(idClsRegex);
	}
	out.class = out.class.filter(e => !!e);

	return out;
}

function createElemFromStr(elemStr, parent, reference, propCallback) {
	const data = parseElemStr(elemStr),
		elem = node(data.tag, data.class, null, data.attr);

	if (data.name && reference)
		reference[data.name] = elem;

	if (parent)
		elem.app(parent);

	if (propCallback) {
		data.id = data.attr.id;
		propCallback(data, elem);
	}

	return elem;
}

const allowedExtraAttrs = {
	style: true
};

function createElemStr(str, inner, extraAttr) {
	inner = inner === undefined ? "" : inner;
	const data = parseElemStr(str);
	let tag = "<" + data.tag;

	if (extraAttr) {
		for (let k in extraAttr) {
			if (hasOwn(extraAttr, k) && hasOwn(allowedExtraAttrs, k)) {
				let attrObj = {};
				attrObj[k] = extraAttr[k];
				inject(data.attr, attrObj);
			}
		}
	}

	if (data.class.length)
		tag += " class=\"" + data.class.join(" ") + "\"";

	for (let k in data.attr) {
		if (hasOwn(data.attr, k)) {
			const dak = data.attr[k];
			let attrVal = data.attr[k];

			if (k == "style") {
				let styles = [];
				for (let k2 in dak) {
					if (hasOwn(dak, k2))
						styles.push(k2 + ": " + dak[k2]);
				}

				attrVal = styles.join("; ");
			}

			tag += " " + k + "=\"" + attrVal + "\"";
		}
	}

	tag += ">";

	if (hasOwn(VOID_TAGS, data.tag))
		return tag;

	return tag + (typeof inner == "function" ? inner() : inner) + "</" + data.tag + ">";
}

function extractAttrs(str) {
	let attrs = {};

	while (true) {
		const ex = attrRegex.exec(str);
		if (!ex)
			break;

		const match = ex[0],
			attr = trimStr(match, 1, 1).trim(),
			propEx = attrPropRegex.exec(attr);

		// If the data in capture group #1 is falsy, it means it's only matched a
		// single = character, which makes the property invalid.
		if (propEx && propEx[1]) {
			let rest = attr.substring(propEx[0].length).trim();
			// Also trim away quotes if the attribute value looks like a string
			rest = stringIdentFullRegex.test(rest) ?
				trimStr(rest, 1, 1) :
				rest;
			attrs[propEx[1]] = rest;
		} else if (attr)	// expect boolean attribute otherwise
			attrs[attr] = true;

		str = str.replace(attrRegex, "");
	}

	return {
		attrs: attrs,
		remainder: str
	};
}

export {
	parseElemStr,
	createElemFromStr,
	createElemStr
};
