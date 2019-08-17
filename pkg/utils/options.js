import { isObject } from "./is";

const blankOptions = Object.freeze({});

function composeOptionsTemplates(...templates) {
	const template = Object.create(null);

	for (let i = 0, l = templates.length; i < l; i++) {
		const tmpl = templates[i];

		if (!tmpl || typeof tmpl != "object")
			continue;

		for (const k in tmpl) {
			if (!Object.hasOwnProperty.call(tmpl, k))
				continue;

			template[k] = isObject(tmpl[k]) ? tmpl[k] : {
				[k]: tmpl[k]
			};
		}
	}

	return template;
}

function createOptionsObject(optionsPrecursor, templates, err) {
	switch (typeof optionsPrecursor) {
		case "string":
			return templates[optionsPrecursor] || (
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
			return templates[optionsPrecursor] || (
					console.error(err || `'${optionsPrecursor}' is not a valid option`) ||
					createOptionsObject(def, templates)
				);
		case "object":
			return optionsPrecursor ? optionsPrecursor : createOptionsObject(def, templates);
		default:
			return createOptionsObject(def, templates);
	}
}

export {
	composeOptionsTemplates,
	createOptionsObject,
	createOptionsObjectWithDefault
};
