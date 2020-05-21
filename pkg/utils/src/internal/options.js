import {
	composeMergerTemplates,
	mergeObject,
	mergeObjectWithDefault
} from "./merge-obj";

function composeOptionsTemplates(...templates) {
	return composeMergerTemplates(...templates);
}

function createOptionsObject(optionsPrecursor, templates, error) {
	return mergeObject(
		optionsPrecursor,
		templates,
		error,
		"option"
	);
}

function createOptionsObjectWithDefault(optionsPrecursor, templates, def, error) {
	return mergeObjectWithDefault(
		optionsPrecursor,
		templates,
		def,
		error,
		"option"
	);
}

export {
	composeOptionsTemplates,
	createOptionsObject,
	createOptionsObjectWithDefault
};
