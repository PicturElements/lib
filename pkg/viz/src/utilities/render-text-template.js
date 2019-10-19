import {
	get,
	inject,
	parseStr,
	trimStr,
	spliceStr
} from "@qtxr/utils";

import { createElemStr } from "./plain-dom";

const textTemplateRegex = /{{((?:\\.|{[^{]|[^{])*?)}}|\[((?:\\.|.)*?)\]/g, 		// /{{((?:[^{}\\]*(?:\\.|{[^{]|}[^}])?)*)}}|\[((?:[^\[\]\\]*(?:\\.)?)*)\]/g,
	unescapeTextTemplateRegex = /\\([{}\[\]])/g,
	tagSplitRegex = /([^\s]+)(.*)/, 											// /\s*((?:[^|\\\s]*(?:\\.)?)*)\s*(?:\|(.*))?/,
	attrSplitRegex = /([^|\s]*?)\s*=\s*(("|')(?:\\.|.)*?\3|[^\s]+)/g,			// /(?:([^\\=\s]*(?:\\.)?)*)\s*=\s*("(?:[^\\"]*(?:\\.)?)*"|'(?:[^\\']*(?:\\.)?)*'|[^\s]+)/g,
	formatRegex = /((?:\\.|[^{}])*?|^){((?:\\.|.)*?)}/, 						// /((?:[^\\{}]+(?:\\.)?|^)){((?:[^\\{}]*(?:\\.)?)*)}/,
	stringIdentFullRegex = /^("(?:\\.|[^"])*?"|'(?:\\.|[^'])*?')$/g,			// /^"(?:[^\\"]*(?:\\.)?)*"|'(?:[^\\']*(?:\\.)?)*'$/g,
	dataSelectorRegex = /^(\d+):/;

export default function renderTextTemplate(template, data, secondaryData, placeholder) {
	template = template || "";
	placeholder = placeholder || "";
	let idx = 0,
		ref = null,
		out = "",
		li = 0;

	while (true) {
		textTemplateRegex.lastIndex = li;
		const ex = textTemplateRegex.exec(template);
		if (!ex)
			break;

		li = textTemplateRegex.lastIndex;

		const matchLen = ex[0].length,
			matchIdx = ex.index;

		out += template.substr(idx, matchIdx - idx);

		if (ex[1]) {		// substitution
			const tagData = processTemplateTag(ex[1]),
				accessor = tagData.accessor.replace(unescapeTextTemplateRegex, "$1").trim(),
				selector = dataSelectorRegex.exec(accessor);

			let item = null;

			if (selector)
				item = get(selector[1] == "0" ? data : secondaryData, accessor.substr(selector[0].length));
			else
				item = get(secondaryData, accessor, get(data, accessor));

			if (typeof item == "function")
				item = item(data, secondaryData, placeholder);
			if (item === undefined)
				item = placeholder;

			out += modifyTag(item, tagData.vars, secondaryData);
			ref = item;
		} else {			// backref
			if (ref != null) {
				const notOne = !isNaN(ref) && Number(ref) != 1,
					repl = ex[2].split("|")[+notOne];

				out += (repl === undefined ? placeholder : repl);
			} else
				out += placeholder;
		}

		idx = matchIdx + matchLen;
	}

	out += template.substr(idx);

	return out;
}

function processTemplateTag(tag) {
	const ex = tagSplitRegex.exec(tag),
		out = {
			accessor: "",
			vars: {}
		};

	if (!ex)
		return out;

	out.accessor = ex[1] || "";
	out.vars = collectTagArgs(ex[2] || "");
	return out;
}

function collectTagArgs(str) {
	let out = {};

	while (true) {
		const ex = attrSplitRegex.exec(str);
		if (!ex)
			break;

		if (ex[0]) {
			const val = ex[2] || "";
			out[ex[1]] = stringIdentFullRegex.test(val) ? trimStr(val, 1, 1) : val;
		}
	}

	return out;
}

const modifyOrder = ["round", "wrap-before", "prefix-wrap", "prefix-wrap", "prefix", "postfix", "style", "wrap"];

function modifyTag(data, vars, inst) {
	const config = {},
		refs = {
			s: get(inst, "config.style"),
			c: get(inst, "config")
		};

	for (let i = 0, l = modifyOrder.length; i < l; i++) {
		const k = modifyOrder[i];

		if (vars.hasOwnProperty(k)) {
			switch (k) {
				case "wrap":
					data = createElemStr(vars.wrap, data, config);
					break;
				case "prefix-wrap":
					vars.prefix = createElemStr(vars["prefix-wrap"], vars.prefix, config);
					break;
				case "postfix-wrap":
					vars.postfix = createElemStr(vars["postfix-wrap"], vars.prefix, config);
					break;
				case "wrap-before":
					data = createElemStr(vars["wrap-before"], data, config);
					break;
				case "round":
					data = isNaN(data) ? data : Number(data).toFixed(parseStr(vars.round));
					break;
				case "prefix":
					data = vars.prefix + "" + data;
					break;
				case "postfix":
					data = data + "" + vars.prefix;
					break;
				case "style":
					const styles = vars.style.trim().split(/\s*;\s*/),
						stylesObj = {};

					for (let i2 = 0, l2 = styles.length; i2 < l2; i2++) {
						const style = styles[i2].trim().split(/\s*:\s*/);

						if (style.length > 1)
							stylesObj[style[0]] = formatTemplateData(style[1], inst, refs);
					}

					inject(config, {
						style: stylesObj
					});
			}
		}
	}

	return data;
}

function formatTemplateData(str, dataTarget, refs, getAsArr) {
	let arr = [];

	while (true) {
		const ex = formatRegex.exec(str);
		if (!ex)
			break;

		const val = get(dataTarget, ex[2], null, {
			references: refs
		});
		str = spliceStr(str, ex[1].length, ex[2].length + 2, val, true);

		if (getAsArr)
			arr.push(val);
	}

	return getAsArr ? arr : str;
}
