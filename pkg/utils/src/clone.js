import {
	composeOptionsTemplates,
	createOptionsObject
} from "./internal/options";
import { PolyMap } from "./internal/poly";
import {
	isObj,
	isArrResolvable,
	isNativeSimpleObject
} from "./is";
import map from "./map";
import hasOwn from "./has-own";

const REF_MAP = new PolyMap();

const OPTIONS_TEMPLATES = composeOptionsTemplates({
	cloneInstances: true,
	shallow: true,
	cloneSymbols: true,
	circular: true
});

export default function clone(obj, options) {
	options = createOptionsObject(options, OPTIONS_TEMPLATES);
	const depth = options.shallow ?
		0 :
		(hasOwn(options, "depth") ?
			options.depth :
			Infinity
		);

	const cl = (o, d, ignore) => {
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

		map(
			o,
			(v, k) => {
				if (isObj(ignore) && hasOwn(ignore, k) && !isObj(ignore[k])) {
					if (typeof ignore[k] == "function") {
						if (ignore[k](v, k, o))
							return map.SKIP;
					} else if (ignore[k])
						return map.SKIP;
				}

				if (!isObj(v) || d >= depth)
					return v;

				if (options.circular) {
					const item = REF_MAP.get(v);

					if (item)
						return item;
				}

				return cl(v, d + 1, );
			}, {
				overSymbols: options.cloneSymbols
			},
			objOut
		);

		if (options.circular)
			REF_MAP.delete(o);

		return objOut;
	};

	return cl(obj, 0, options.ignore);
}
