import {
	composeMergerTemplates,
	mergeObject,
	mergeObjectWithDefault
} from "./merge-obj";
import { isObject } from "./duplicates";

function composeOptionsTemplates(...templates) {
	return composeMergerTemplates(...templates);
}

function createOptionsObject(optionsPrecursor, templates, error = null) {
	return mergeObject(
		optionsPrecursor,
		templates,
		error,
		"option"
	);
}

function createOptionsObjectWithDefault(optionsPrecursor, templates, def, error = null) {
	return mergeObjectWithDefault(
		optionsPrecursor,
		templates,
		def,
		error,
		"option"
	);
}

function optionize(target, initializer, ...templates) {
	return createOptionizer(target, initializer, templates, createOptionsObject);
}

function createOptionizer(target, initializer, templates, merger) {
	const optionsTemplates = composeOptionsTemplates(...templates),
		init = typeof initializer == "function" ?
			initializer :
			_ => ({});

	target.with = (options, override = true) => {
		options = merger(options, optionsTemplates);
	
		if (!isObject(options))
			return target;
	
		if (target._options) {
			if (override)
				target._options = Object.assign(parsePugStr._options, options);
			else
				target._options = Object.assign({}, options, parsePugStr._options);
		} else
			target._options = Object.assign(init(options, override), options);
	
		return target;
	};

	target.extractOptions = (options, override) => {
		if (options)
			target.with(options, override);

		const out = target._options;
		target._options = null;
		return out;
	};
	
	target._options = null;
	return target;
}

export {
	composeOptionsTemplates,
	createOptionsObject,
	createOptionsObjectWithDefault,
	optionize,
	createOptionizer
};
