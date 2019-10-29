import { isObject } from "./is";
import { getEnvType } from "./env";
import hasOwn from "./has-own";

const blankOptions = Object.freeze({});

function composeOptionsTemplates(...templates) {
	const templatesOut = Object.create(null);

	for (let i = 0, l = templates.length; i < l; i++) {
		const template = templates[i];

		if (!template || typeof template != "object")
			continue;

		for (const k in template) {
			if (!hasOwn(template, k))
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

function createOptionsObject(optionsPrecursor, templates, err) {
	switch (typeof optionsPrecursor) {
		case "string":
			return templates[optionsPrecursor] || tryBundle(optionsPrecursor, templates) || (
				logResolveError(err, optionsPrecursor, templates) ||
				blankOptions
			);
		case "object":
			if (Array.isArray(optionsPrecursor))
				return mergeOptions(optionsPrecursor, templates, err);
			
			return optionsPrecursor ? optionsPrecursor : blankOptions;
		default:
			return blankOptions;
	}
}

function createOptionsObjectWithDefault(optionsPrecursor, templates, def, err) {
	switch (typeof optionsPrecursor) {
		case "string":
			return templates[optionsPrecursor] || tryBundle(optionsPrecursor, templates) || (
				logResolveError(err, optionsPrecursor, templates) ||
				createOptionsObject(def, templates)
			);
		case "object":
			if (Array.isArray(optionsPrecursor))
				return mergeOptions(optionsPrecursor, templates, err);

			return optionsPrecursor ? optionsPrecursor : createOptionsObject(def, templates);
		default:
			return createOptionsObject(def, templates);
	}
}

function tryBundle(optionsStr, templates) {
	if (optionsStr.indexOf("|") == -1)
		return null;

	const options = optionsStr.trim().split(/\s*\|\s*/),
		template = {};

	for (let i = 0, l = options.length; i < l; i++) {
		const templ = templates[options[i]];

		if (templ)
			Object.assign(template, templ);
		else {
			console.error(`Failed to bundle option '${options[i]}': no option with that name exists`);
			return null;
		}
	}

	templates[optionsStr] = Object.freeze(template);
	return templates[optionsStr];
}

function logResolveError(err, option, templates) {
	console.error(err || `'${option}' is not a valid option`);

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

function mergeOptions(options, templates, err) {
	const template = Object.create(null);

	for (let i = 0, l = options.length; i < l; i++) {
		const option = createOptionsObject(options[i], templates, err);

		for (const k in option) {
			if (!hasOwn(option, k))
				continue;

			template[k] = option[k];
		}
	}

	return Object.freeze(template);
}

export {
	composeOptionsTemplates,
	createOptionsObject,
	createOptionsObjectWithDefault
};
