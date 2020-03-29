import {
	isObj,
	isArrResolvable,
	isNativeSimpleObject
} from "./is";
import {
	composeOptionsTemplates,
	createOptionsObject
} from "./options";
import map from "./map";
import hasOwn from "./has-own";
import { QNDMap } from "./internal/poly";
import { sym } from "./sym";
import { extend } from "./obj";

export default function clone(obj, options) {
	options = createOptionsObject(options, optionsTemplates);
	const inexMap = options.circular ?
			new QNDMap() :
			null,
		depth = options.shallow ?
			0 :
			(hasOwn(options, "depth") ?
				options.depth :
				Infinity
			),
		clonedSym = options.circular ?
			sym("cloned") :
			null;

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
			extend(o, clonedSym, objOut, (t, k, v) => inexMap.set(o, v));

		map(o, v => {
			if (!isObj(v) || d >= depth)
				return v;

			if (options.circular) {
				if (!Object.isExtensible(o)) {
					const item = inexMap.get(o);

					if (item)
						return item;
				} else if (hasOwn(v, clonedSym))
					return v[clonedSym];
			}

			return cl(v, d + 1);
		}, null, objOut);

		if (options.cloneSymbols && typeof Symbol != "undefined") {
			const symbols = Object.getOwnPropertySymbols(o);

			for (let i = 0, l = symbols.length; i < l; i++) {
				const sym = symbols[i];

				if (sym == clonedSym)
					continue;

				objOut[sym] = d < depth ?
					cl(o[sym], d + 1) :
					o[sym];
			}
		}

		if (options.circular)
			delete o[clonedSym];

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
