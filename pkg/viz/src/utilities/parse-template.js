import {
	clone,
	filterMut,
	parsePugStr,
	parseTreeStr,
	overrideAttributes
} from "@qtxr/utils";

const subTemplateDeclaratorRegex = /^@(\w+)$/,
	templateRegex = /^(@(\w+))?([\w.#-]*(?:\(.*?\))?)(?:\s*(?:as|:)\s*(\w+))?$/;

const CRITERION_EXEMPT_ATTRS = {
	class: true,
	id: true,
	data: true
};

export default function parseTemplate(tmpl) {
	const nodes = parseTreeStr(tmpl),
		subTemplates = {};

	// First find sub-templates
	filterMut(nodes, node => {
		const ex = subTemplateDeclaratorRegex.exec(node.raw);
		if (!ex)
			return true;

		subTemplates[ex[1]] = {
			type: "subTemplate",
			parsingInitialized: false,
			parsed: null,
			children: node.children,
			criteria: [],
			id: null
		};

		return false;
	});

	return parseSubTemplate({
		type: "root",
		parsingInitialized: false,
		parsed: null,
		children: nodes,
		criteria: [],
		id: null
	}, subTemplates);
}

function parseSubTemplate(template, subTemplates) {
	template.parsingInitialized = true;

	if (template.children.length != 1)
		throw new Error(`Failed to parse template: templates must have exactly one top level child`);
		
	const traverse = node => {
		const ex = templateRegex.exec(node.raw);

		if (!ex)
			throw new Error(`Failed to parse template: invalid formatting (line ${node.row})\n'${node.raw}'`);

		const nodeData = parsePugStr(ex[3])[0];
		let outNode = {
			tag: nodeData && nodeData.tag,
			attributes: nodeData && nodeData.attributes,
			children: [],
			criteria: [],
			id: null
		};

		// sub-template reference
		if (ex[1]) {
			const subTemplateName = ex[2],
				subTemplate = subTemplates[subTemplateName];

			if (!subTemplates.hasOwnProperty(subTemplateName))
				throw new Error(`Failed to parse template: no sub-template by name '${subTemplateName}' found`);
			if (!subTemplate.parsed && subTemplate.parsingInitialized)
				throw new Error(`Failed to parse template: circular data found at '${subTemplateName}'`);

			const parsedTemplate = clone(subTemplate.parsed ? subTemplate.parsed : parseSubTemplate(subTemplate, subTemplates));
			overrideAttributes(parsedTemplate.attributes, nodeData.attributes);
			outNode = parsedTemplate;
		}
		
		outNode.criteria = extractCriteria(outNode.attributes);
		outNode.id = ex[4] || outNode.id;

		for (let i = 0, l = node.children.length; i < l; i++)
			outNode.children.push(traverse(node.children[i]));

		return outNode;
	};

	template.parsed = traverse(template.children[0]);

	return template.parsed;
}

function extractCriteria(attrs) {
	const criteria = [];

	for (const k in attrs) {
		if (!attrs.hasOwnProperty(k) || CRITERION_EXEMPT_ATTRS.hasOwnProperty(k))
			continue;

		criteria.push({
			criterion: k,
			matches: attrs[k]
		});
	}

	return criteria;
}
