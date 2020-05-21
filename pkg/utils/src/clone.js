import {
	isObj,
	isArrResolvable,
	isNativeSimpleObject
} from "./is";
import map from "./map";
import hasOwn from "./has-own";
import { QNDMap } from "./internal/poly";
import {
	composeOptionsTemplates,
	createOptionsObject
} from "./internal/options";

const REF_MAP = new QNDMap();

export default function clone(obj, options) {
	options = createOptionsObject(options, optionsTemplates);
	const depth = options.shallow ?
		0 :
		(hasOwn(options, "depth") ?
			options.depth :
			Infinity
		);

	const cl = (o, d) => {
		if (!isObj(o))
			return o;
		
		// Check if the object is a direct instance of anything else than Object
		// or Array, in which case we don't want to copy over the object naively,
		// as the prototypes aren't transferred and we probably don't wish to deep copy
		// instances anyway
		if (!isNativeSimpleObject(o) && !options.cloneInstances)
			return o;

		const objOut = isArrResolvable(o) ? [] : {};

		if (options.circular)
			REF_MAP.set(o, objOut);

		map(o, v => {
			if (!isObj(v) || d >= depth)
				return v;

			if (options.circular) {
				const item = REF_MAP.get(v);

				if (item)
					return item;
			}

			return cl(v, d + 1);
		}, null, objOut);

		if (options.cloneSymbols && typeof Symbol != "undefined") {
			const symbols = Object.getOwnPropertySymbols(o);

			for (let i = 0, l = symbols.length; i < l; i++) {
				const sym = symbols[i];

				objOut[sym] = d < depth ?
					cl(o[sym], d + 1) :
					o[sym];
			}
		}

		if (options.circular)
			REF_MAP.delete(o);

		return objOut;
	};

	return cl(obj, 0);
}

const optionsTemplates = composeOptionsTemplates({
	cloneInstances: true,
	shallow: true,
	cloneSymbols: true,
	circular: true
});
