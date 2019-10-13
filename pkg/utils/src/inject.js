import { coerceToObj } from "./coerce";
import { isNativeSimpleObject, isObj } from "./is";
import clone from "./clone";
import {
	composeOptionsTemplates,
	createOptionsObject
} from "./options";

/*	OPTIONS={	// options, assumed default value, action
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

	function inj(targ, ext) {
		targ = coerceToObj(targ, ext);
		ext = coerceToObj(ext);

		if (Array.isArray(ext)) {
			for (let i = 0, l = ext.length; i < l; i++)
				doInject(i, targ, ext);
		} else {
			for (let k in ext)
				doInject(k, targ, ext);
		}

		if (options.injectSymbols && typeof Symbol != "undefined") {
			const symbols = Object.getOwnPropertySymbols(ext);

			for (let i = 0, l = symbols.length; i < l; i++)
				doInject(symbols[i], targ, ext);
		}

		return targ;
	}

	function doInject(key, targ, ext) {
		let ek = ext[key];
	
		if (ext.hasOwnProperty(key) && (!options.noUndef || ek !== undefined)) {
			if (isObj(ek) && (options.preserveInstances || isNativeSimpleObject(ek)) && !options.shallow)
				targ[key] = inj(targ[key], ek);
			else if (!targ.hasOwnProperty(key) || options.override)
				targ[key] = ek;
		}
	}

	return inj(target, extender);
}

const optionsTemplates = composeOptionsTemplates({
	cloneExtender: true,
	injectDataset: {
		cloneExtender: true,
		override: true,
	},
});
