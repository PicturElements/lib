import {
	get,
	sym,
	hasOwn,
	isObject,
	createOptionsObject
} from "@qtxr/utils";

const OPTIONS_PARTITION_SYM = sym("options partition");

function addOptionsPartition(cls, options, key, optionsTemplates) {
	if (isObject(options) && hasOwn(options, key)) {
		if (isObject(optionsTemplates))
			cls[OPTIONS_PARTITION_SYM] = createOptionsObject(options[key], optionsTemplates);
		else if (isObject(options[key]))
			cls[OPTIONS_PARTITION_SYM] = options[key];
		else
			cls[OPTIONS_PARTITION_SYM] = {};
	} else
		cls[OPTIONS_PARTITION_SYM] = {};
}

function opt(cls, accessor) {
	return get(cls[OPTIONS_PARTITION_SYM], accessor);
}

export {
	addOptionsPartition,
	opt
};
