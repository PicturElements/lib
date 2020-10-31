import {
	sym,
	setSymbol,
	hasOwn,
	isConstructor
} from "@qtxr/utils";
import { META } from "./symbols";
import Options from "./options";

const Manage = {
	declare(constr, meta) {
		// Assertions
		if (!isConstructor(constr))
			throw new Error("Cannot declare class: provided value is not constructible");
		if (!meta)
			throw new Error("Cannot declare class: no meta supplied");
		if (!meta.name)
			throw new Error("Cannot declare class: no name provided");
		if (!meta.namespace)
			throw new Error(`Cannot declare class: no namespace provided in ${meta.name}`);
		if (hasOwn(Manage.constructors, meta.namespace))
			throw new Error(`Cannot declare class: namespace '${meta.namespace}' already in use by ${Manage.constructors[meta.namespace][META].name}`);

		assertMembers(constr, meta.static);
		assertMembers(constr.prototype, meta.proto);

		if (typeof constr.prototype[Manage.CONSTRUCTOR] != "function")
			constr.prototype[Manage.CONSTRUCTOR] = _ => _;

		const cs = Manage.constructorSymbols,
			cSym = cs[meta.namespace] || sym(`${meta.name} constructor`);

		cs[meta.namespace] = cSym;
		Manage.constructors[meta.namespace] = constr;

		setSymbol(constr.prototype, cSym, constr.prototype[Manage.CONSTRUCTOR]);
		delete constr.prototype[Manage.CONSTRUCTOR];

		constr.opt = (inst, accessor = "", def = null) => {
			return Options.resolve(constr, inst, accessor, def);
		};

		constr[META] = Object.assign({
			constructorMethod: constr.prototype[cSym]
		}, meta);
	},
	instantiate(constr, inst, options) {
		const meta = constr[META];
		Options.addPartition(constr, inst, options, meta.optionsTemplates);
		meta.constructorMethod.call(
			inst,
			Options.mkResolver(constr, inst)
		);
	},
	instantiateAll(constructors, inst, options) {
		for (let i = 0, l = constructors.length; i < l; i++)
			Manage.instantiate(constructors[i], inst, options);
	},
	CONSTRUCTOR: sym("constructor placeholder"),
	constructors: {},
	constructorSymbols: {}
};

function assertMembers(source, names) {
	names = toArr(names);

	for (let i = 0, l = names.length; i < l; i++) {
		if (!hasOwn(source, names[i]))
			throw new Error(`Cannot declare class: no member with the name '${names[i]}' is available on the class`);
	}
}

function toArr(candidate) {
	if (!candidate)
		return [];

	return Array.isArray(candidate) ? candidate : [candidate];
}

export default Manage;
