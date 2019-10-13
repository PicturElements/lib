import { isNativeSimpleObject } from "./is";
import {
	composeOptionsTemplates,
	createOptionsObject
} from "./options";
import map from "./map";

export default function clone(obj, options) {
	options = createOptionsObject(options, optionsTemplates);
	const depth = options.shallow ? 0 : (options.hasOwnProperty("depth") ? options.depth : Infinity);

	function cl(o, d) {
		if (typeof o == "object" && o != null) {
			// Check if the object is a direct instance of anything else than Object
			// or Array, in which case we don't want to copy over the object naively,
			// as the prototypes aren't transferred and we probably don't wish to deep copy
			// instances anyway
			if (!isNativeSimpleObject(o) && !options.cloneInstances)
				return o;

			const objOut = map(o, v => {
				return d < depth ? cl(v, d + 1) : v;
			});

			if (options.cloneSymbols && typeof Symbol != "undefined") {
				const symbols = Object.getOwnPropertySymbols(o);

				for (let i = 0, l = symbols.length; i < l; i++) {
					const sym = symbols[i];
					objOut[sym] = d < depth ? cl(o[sym], d + 1) : o[sym];
				}
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
	cloneSymbols: true
});
