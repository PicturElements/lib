import { isObject } from "./is";

const blankOptions = Object.freeze({});

function composeOptionsTemplates(...templates) {
	const templatesOut = Object.create(null);

	for (let i = 0, l = templates.length; i < l; i++) {
		const template = templates[i];

		if (!template || typeof template != "object")
			continue;

		for (const k in template) {
			if (!Object.hasOwnProperty.call(template, k))
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
				console.error(err || `'${optionsPrecursor}' is not a valid option`) ||
				blankOptions
			);
		case "object":
			return optionsPrecursor ? optionsPrecursor : blankOptions;
		default:
			return blankOptions;
	}
}

function createOptionsObjectWithDefault(optionsPrecursor, templates, def, err) {
	switch (typeof optionsPrecursor) {
		case "string":
			return templates[optionsPrecursor] || tryBundle(optionsPrecursor, templates) || (
				console.error(err || `'${optionsPrecursor}' is not a valid option`) ||
				createOptionsObject(def, templates)
			);
		case "object":
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
	}

	templates[optionsStr] = Object.freeze(template);
	return templates[optionsStr];
}

export {
	composeOptionsTemplates,
	createOptionsObject,
	createOptionsObjectWithDefault
};
