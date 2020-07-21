import {
	composeMergerTemplates,
	mergeObject,
	mergeObjectWithDefault
} from "./internal/merge-obj";
import { createOptionizer } from "./internal/options";
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
		(targ, src) => inject(targ, src, "override")
	);
}

function createOptionsObjectWithDefault(optionsPrecursor, templates, def, error) {
	return mergeObjectWithDefault(
		optionsPrecursor,
		templates,
		def,
		error,
		"option",
		(targ, src) => inject(targ, src, "override")
	);
}

function optionize(target, initializer, ...templates) {
	return createOptionizer(
		target,
		initializer,
		templates,
		createOptionsObject
	);
}

export {
	composeOptionsTemplates,
	createOptionsObject,
	createOptionsObjectWithDefault,
	optionize
};
