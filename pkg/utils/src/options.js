import {
	composeMergerTemplates,
	mergeObject,
	mergeObjectWithDefault
} from "./internal/merge-obj";
import inject from "./inject";

function composeOptionsTemplates(...templates) {
	return composeMergerTemplates(...templates);
}

function createOptionsObject(optionsPrecursor, templates, error) {
	return mergeObject(
		optionsPrecursor,
		templates,
		error,
		"option",
		inject
	);
}

function createOptionsObjectWithDefault(optionsPrecursor, templates, def, error) {
	return mergeObjectWithDefault(
		optionsPrecursor,
		templates,
		def,
		error,
		"option",
		inject
	);
}

export {
	composeOptionsTemplates,
	createOptionsObject,
	createOptionsObjectWithDefault
};
