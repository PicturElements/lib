import {
	sym,
	get,
	hasOwn,
	isObject,
	setSymbol,
	createOptionsObject
} from "@qtxr/utils";
import { META } from "./symbols";

const OPTIONS = sym("options");

const Options = {
	addPartition(constr, inst, options, templates = null) {
		const meta = constr[META],
			ns = meta.namespace;

		const root = inst[OPTIONS] || {};
		if (!hasOwn(inst, OPTIONS))
			setSymbol(inst, OPTIONS, root);

		if (isObject(options) && hasOwn(options, ns)) {
			if (isObject(templates))
				root[ns] = createOptionsObject(options[ns], templates);
			else if (isObject(options[ns]))
				root[ns] = options[ns];
			else
				root[ns] = {};
		} else
			root[ns] = {};
	},
	resolve(constr, inst, accessor = "", def = null) {
		const ns = constr[META].namespace;
		return get(inst[OPTIONS][ns], accessor, def);
	},
	mkResolver(constr, inst) {
		const ns = constr[META].namespace;
		return (accessor = "", def = null) => get(inst[OPTIONS][ns], accessor, def);
	}
};

export default Options;
