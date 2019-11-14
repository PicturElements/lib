import {
	isObj,
	isArrResolvable,
	isNativeSimpleObject
} from "./is";
import {
	composeOptionsTemplates,
	createOptionsObject
} from "./options";
import { sym } from "./sym";
import map from "./map";
import hasOwn from "./has-own";

export default function clone(obj, options) {
	options = createOptionsObject(options, optionsTemplates);
	const depth = options.shallow ? 0 :
			(options.hasOwnProperty("depth") ? options.depth :
			Infinity),
		clonedSym = options.circular ? sym("cloned") : null;

	function cl(o, d) {
		if (typeof o == "object" && o != null) {
			// Check if the object is a direct instance of anything else than Object
			// or Array, in which case we don't want to copy over the object naively,
			// as the prototypes aren't transferred and we probably don't wish to deep copy
			// instances anyway
			if (!isNativeSimpleObject(o) && !options.cloneInstances)
				return o;

			const objOut = isArrResolvable(o) ? [] : {};

			if (options.circular)
				o[clonedSym] = objOut;

			map(o, v => {
				if (options.circular) {
					return d < depth ?
						(isObj(v) && hasOwn(v, clonedSym, true) ? v[clonedSym] : cl(v, d + 1)) :
						v;
				}

				return d < depth ? cl(v, d + 1) : v;
			}, null, objOut);

			if (options.cloneSymbols && typeof Symbol != "undefined") {
				const symbols = Object.getOwnPropertySymbols(o);

				for (let i = 0, l = symbols.length; i < l; i++) {
					const sym = symbols[i];
					objOut[sym] = d < depth ? cl(o[sym], d + 1) : o[sym];
				}
			}

			if (options.circular) {
				delete o[clonedSym];
			}

			return objOut;
		}

		return o;
	}

	return cl(obj, 0);
}

const optionsTemplates = composeOptionsTemplates({
	cloneInstances: true,
	shallow: true,
	cloneSymbols: true,
	circular: true
});
