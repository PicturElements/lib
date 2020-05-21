import { getEnvType } from "../env";
import hasOwn from "../has-own";

// To reduce call overhead, functions in this file take a large number of arguments.
// It's recommended that these functions never face public APIs, but rather
// are called through separate, specific abstractions (see: options.js, presets.js)

const blank = Object.freeze({});

function composeMergerTemplates(...templates) {
	const templatesOut = Object.create(null);

	for (let i = 0, l = templates.length; i < l; i++) {
		const template = templates[i];

		if (!template || typeof template != "object")
			continue;

		for (const k in template) {
			if (!hasOwn(template, k, false))
				continue;

			templatesOut[k] = Object.freeze(
				isObject(template[k]) ?
					template[k] :
					{
						[k]: template[k]
					}
			);
		}
	}

	return templatesOut;
}

function addMergerTemplate(
	templates,
	key,
	template,
	mergeType = "merge"
) {
	if (typeof key != "string") {
		console.error(`Failed to create ${mergeType} template: key is not a string`);
		return templates;
	}

	templates[key] = Object.freeze(
		isObject(template) ?
			template :
			{
				[key]: template
			}
	);

	return templates;
}

function mergeObject(
	mergerPrecursor,
	templates,
	error,
	mergeType = "merge",
	mergeFunction = Object.assign
) {
	switch (typeof mergerPrecursor) {
		case "string":
			return templates[mergerPrecursor] || tryBundle(mergerPrecursor, templates, mergeType) || (
				logMergeError(error, mergerPrecursor, templates, mergeType) ||
				blank
			);

		case "object":
			if (Array.isArray(mergerPrecursor))
				return merge(mergerPrecursor, templates, error, mergeType, mergeFunction);
			
			return mergerPrecursor ?
				mergerPrecursor :
				blank;

		default:
			return blank;
	}
}

function mergeObjectWithDefault(
	optionsPrecursor,
	templates,
	def,
	error,
	mergeType = "merge",
	mergeFunction = Object.assign
) {
	switch (typeof optionsPrecursor) {
		case "string":
			return templates[optionsPrecursor] || tryBundle(optionsPrecursor, templates, mergeType) || (
				logMergeError(error, optionsPrecursor, templates, mergeType) ||
				mergeObject(def, templates, error, mergeType)
			);

		case "object":
			if (Array.isArray(optionsPrecursor))
				return merge(optionsPrecursor, templates, error, mergeType, mergeFunction);

			return optionsPrecursor ?
				optionsPrecursor :
				mergeObject(def, templates, error, mergeType);

		default:
			return mergeObject(def, templates, error, mergeType);
	}
}

function tryBundle(optionsStr, templates, mergeType = "merge") {
	if (optionsStr.indexOf("|") == -1)
		return null;

	const options = optionsStr.trim().split(/\s*\|\s*/),
		template = {};

	for (let i = 0, l = options.length; i < l; i++) {
		const templ = templates[options[i]];

		if (templ)
			Object.assign(template, templ);
		else {
			console.error(`Failed to bundle ${mergeType} object '${options[i]}': no template with that name exists`);
			return null;
		}
	}

	templates[optionsStr] = Object.freeze(template);
	return templates[optionsStr];
}

function logMergeError(error, option, templates, mergeType = "merge") {
	console.error(error || `'${option}' is not a valid ${mergeType} object`);

	if (getEnvType() != "window")
		return;

	console.groupCollapsed("Expand to view the currently supported options");
	const keys = Object.keys(templates).sort();

	for (let i = 0, l = keys.length; i < l; i++) {
		const key = keys[i];

		console.groupCollapsed(key);
		console.log(templates[key]);
		console.groupEnd();
	}

	console.groupEnd();
}

function merge(
	options,
	templates,
	error,
	mergeType = "merge",
	mergeFunction = Object.assign
) {
	const template = Object.create(null);

	for (let i = 0, l = options.length; i < l; i++) {
		const merger = mergeObject(options[i], templates, error, mergeType);
		mergeFunction(template, merger);
	}

	return Object.freeze(template);
}

// Copy of the isObject utility in src/is, duplicated
// to remove circular dependency problems
function isObject(val) {
	if (!val)
		return false;

	const proto = Object.getPrototypeOf(val);
	return proto == null || proto == Object.prototype;
}

export {
	composeMergerTemplates,
	addMergerTemplate,
	mergeObject,
	mergeObjectWithDefault
};
