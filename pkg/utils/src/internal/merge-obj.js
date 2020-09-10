import { getEnvType } from "../env";
import { isObject } from "./duplicates";
import hasOwn from "../has-own";

// To reduce call overhead, functions in this file take a large number of arguments.
// It's recommended that these functions never face public APIs, but rather
// are called through separate, specific abstractions (see: options.js, presets.js)

const BLANK = Object.freeze({});

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
	type = "merge"
) {
	if (typeof key != "string") {
		console.error(`Failed to create ${type} template: key is not a string`);
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
	type = "merge",
	merger = Object.assign
) {
	switch (typeof mergerPrecursor) {
		case "string":
			return templates[mergerPrecursor] || tryBundle(mergerPrecursor, templates, type) || (
				logMergeError(error, mergerPrecursor, templates, type) ||
				BLANK
			);

		case "object":
			if (Array.isArray(mergerPrecursor))
				return merge(mergerPrecursor, templates, error, type, merger);

			return mergerPrecursor ?
				mergerPrecursor :
				BLANK;

		default:
			return BLANK;
	}
}

function mergeObjectWithDefault(
	optionsPrecursor,
	templates,
	def,
	error,
	type = "merge",
	merger = Object.assign
) {
	switch (typeof optionsPrecursor) {
		case "string":
			return templates[optionsPrecursor] || tryBundle(optionsPrecursor, templates, type) || (
				logMergeError(error, optionsPrecursor, templates, type) ||
				mergeObject(def, templates, error, type)
			);

		case "object":
			if (Array.isArray(optionsPrecursor))
				return merge(optionsPrecursor, templates, error, type, merger);

			return optionsPrecursor ?
				optionsPrecursor :
				mergeObject(def, templates, error, type);

		default:
			return mergeObject(def, templates, error, type);
	}
}

function tryBundle(optionsStr, templates, type = "merge") {
	if (optionsStr.indexOf("|") == -1)
		return null;

	const options = optionsStr.trim().split(/\s*\|\s*/),
		template = {};

	for (let i = 0, l = options.length; i < l; i++) {
		const templ = templates[options[i]];

		if (templ)
			Object.assign(template, templ);
		else {
			console.error(`Failed to bundle ${type} object '${options[i]}': no template with that name exists`);
			return null;
		}
	}

	templates[optionsStr] = Object.freeze(template);
	return templates[optionsStr];
}

function logMergeError(error, option, templates, type = "merge") {
	console.error(error || `'${option}' is not a valid ${type} object`);

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
	type = "merge",
	merger = Object.assign
) {
	const template = Object.create(null);

	for (let i = 0, l = options.length; i < l; i++) {
		const obj = mergeObject(options[i], templates, error, type);
		merger(template, obj);
	}

	return Object.freeze(template);
}

export {
	composeMergerTemplates,
	addMergerTemplate,
	mergeObject,
	mergeObjectWithDefault
};
