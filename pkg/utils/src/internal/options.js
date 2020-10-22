import {
	composeMergerTemplates,
	mergeObject,
	mergeObjectWithDefault
} from "./merge-obj";
import {
	assign,
	isObject
} from "./duplicates";

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

function optionize(target, initializerOrTemplate, ...templates) {
	return createOptionizer(target, initializerOrTemplate, templates, createOptionsObject);
}

function createOptionizer(target, initializerOrTemplate, templates, merger) {
	let init = initializerOrTemplate;

	if (typeof init != "function") {
		if (init)
			templates = [init].concat(templates);

		init = _ => ({});
	}

	const optionsTemplates = composeOptionsTemplates(...templates);

	const applyInit = options => {
		options = merger(options, optionsTemplates);
		
		if (!isObject(options))
			return {};

		return assign(init(options), options);
	};

	const applyWith = (optionsTarget, options, override = true) => {
		options = merger(options, optionsTemplates);
		
		if (!isObject(options))
			return optionsTarget;

		if (override)
			return assign(optionsTarget, options);
		else
			return assign({}, options, optionsTarget);
	};

	const assertClosed = _ => {
		if (target._opened)
			throw new Error("Cannot use optionizer: external session in use. Resolve options with extractOptions");
	};

	target.with = options => {
		assertClosed();
		let optionsTarget = applyInit(options);

		const targetProxy = function(...args) {
			target._options = optionsTarget;
			target._opened = true;
			const retVal = target.apply(this, args);
			target._opened = false;
			return retVal;
		};

		targetProxy.with = (options, override = true) => {
			assertClosed();
			optionsTarget = applyWith(optionsTarget, options, override);
			return targetProxy;
		};

		return targetProxy;
	};

	target.extractOptions = (options, override = true, def = {}) => {
		let outOptions = def;

		if (target._opened) {
			outOptions = applyWith(target._options, options, override);
		} else if (options)
			outOptions = applyInit(options);

		target._opened = false;
		return outOptions;
	};

	target.extractOptionsNullable = (options, override = true) => {
		return target.extractOptions(options, override, null);
	};
	
	target._options = {};
	target._opened = false;
	return target;
}

export {
	composeOptionsTemplates,
	createOptionsObject,
	createOptionsObjectWithDefault,
	optionize,
	createOptionizer
};
