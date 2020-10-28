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

function createOptionsObject(optionsPrecursor, templates, withRestOrError, error) {
	let withRest = withRestOrError;

	if (typeof withRest != "boolean") {
		error = withRest;
		withRest = false;
	}

	return mergeObject(
		optionsPrecursor,
		templates,
		error,
		"option",
		(targ, src) => inject(targ, src, "override"),
		true,
		withRest
	);
}

function createOptionsObjectWithDefault(optionsPrecursor, templates, def, withRestOrError, error) {
	let withRest = withRestOrError;

	if (typeof withRest != "boolean") {
		error = withRest;
		withRest = false;
	}
	
	return mergeObjectWithDefault(
		optionsPrecursor,
		templates,
		def,
		error,
		"option",
		(targ, src) => inject(targ, src, "override"),
		true,
		withRest
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
