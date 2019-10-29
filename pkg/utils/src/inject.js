import { coerceToObj } from "./coerce";
import {
	isObj,
	isArrayLike,
	isNativeSimpleObject
} from "./is";
import clone from "./clone";
import hasOwn from "./has-own";
import matchType from "./match-type";
import matchQuery from "./match-query";
import {
	composeOptionsTemplates,
	createOptionsObject
} from "./options";

/*
	OPTIONS = {	// options, assumed default value, action
		cloneTarget: false		- clone the target object before injecting (boolean)
		cloneExtender: false	- clone the extender object before injecting
		clone: false			- clone both target and extender before injecting
		noUndef: false			- don't inject if extender property is undefined
		preserveInstances: true	- inject any instance variables that are not arrays or simple objects without cloning them
		root: null				- extract data from this object using the extender's keys/array values as keys for extension
		override: false			- override the target object data with data from the extender primitive by primitive
		shallow: false 			- shallow extend - not recursive
	}
*/

export default function inject(target, extender, options) {
	options = createOptionsObject(options, optionsTemplates);
		
	target = coerceToObj(target, extender);
	extender = coerceToObj(extender);

	if (options.clone || options.cloneTarget)
		target = clone(target);
	if (options.clone || options.cloneExtender)
		extender = clone(extender);

	if (options.root) {
		let newExtender = {},
			extenderIsArr = Array.isArray(extender);

		for (let k in extender) {
			let key = extenderIsArr ? extender[k] : k;

			if (extender.hasOwnProperty(k))
				newExtender[key] = options.root[extender[k]];
		}

		extender = newExtender;
	}

	function inj(targ, ext, schema) {
		targ = coerceToObj(targ, ext);
		ext = coerceToObj(ext);

		if (Array.isArray(ext)) {
			for (let i = 0, l = ext.length; i < l; i++)
				doInject(i, targ, ext, schema, false);
		} else {
			for (let k in ext)
				doInject(k, targ, ext, schema, options.injectSymbols);
		}

		if (options.injectSymbols && typeof Symbol != "undefined") {
			const symbols = Object.getOwnPropertySymbols(ext);

			for (let i = 0, l = symbols.length; i < l; i++)
				doInject(symbols[i], targ, ext, schema, true);
		}

		return targ;
	}

	function doInject(key, targ, ext, schema, allowSymbols) {
		let ek = ext[key];

		if (options.strictSchema && (!isObj(schema) || !hasOwn(schema, key)))
			return;

		if (isObj(schema)) {
			if (schema[key] === false)
				return;
			
			if (isObj(schema[key]) && (!isObj(ext[key]) || Array.isArray(schema[key]) != isArrayLike(ext[key])))
				return;
		}
	
		if (hasOwn(ext, key, allowSymbols) && (!options.noUndef || ek !== undefined)) {
			if (isObj(ek) && (options.preserveInstances || isNativeSimpleObject(ek)) && !options.shallow)
				targ[key] = inj(targ[key], ek, schema && schema[key]);
			else if (!targ.hasOwnProperty(key) || options.override)
				targ[key] = ek;
		}
	}

	return inj(
		target,
		extender,
		options.schema ? matchQuery(
			extender,
			options.schema,
			[
				"deep|returnMatchMap",
				options.schemaOptions || "typed"
			]
		).matchMap : null
	);
}

const optionsTemplates = composeOptionsTemplates({
	clone: true,
	cloneTarget: true,
	cloneExtender: true,
	injectDataset: {
		cloneExtender: true,
		override: true,
	},
	override: true,
	noUndef: true,
	shallow: true,
	preserveInstances: true,
	strictSchema: true
});
