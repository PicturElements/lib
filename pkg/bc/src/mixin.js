import {
	sym,
	hasOwn
} from "@qtxr/utils";
import {
	META,
	Manage
} from "./common";

const RESOLVED_MIXIN = sym("resolved mixin");

export default function mixin(...constructors) {
	const resolvePacket = {
		precedences: [],
		map: {}
	};

	for (let i = 0, l = constructors.length; i < l; i++)
		resolvePrecedence(constructors[i], resolvePacket, 0);

	const constr = applyMixin(resolvePacket.precedences);
	constr[RESOLVED_MIXIN] = constructors;
	return constr;
}

function resolvePrecedence(constr, packet, depth = 0) {
	if (constr[RESOLVED_MIXIN]) {
		const constructors = constr[RESOLVED_MIXIN];
		for (let i = 0, l = constructors.length; i < l; i++)
			resolvePrecedence(constructors[i], packet, depth);
		return;
	}

	if (!constr[META])
		throw new Error("Cannot mixin: constructor isn't a recognized base class");
	const meta = constr[META];

	if (hasOwn(packet.map, meta.namespace)) {
		const precedence = packet.precedences[packet.map[meta.namespace]],
			idx = precedence.indexOf(constr);

		if (idx > -1)
			precedence.splice(idx, 1);
	}

	if (meta.extends) {
		const ext = toArr(meta.extends);

		for (let i = 0, l = ext.length; i < l; i++)
			resolvePrecedence(ext[i], packet, depth + 1);
	}

	const precedence = packet.precedences[depth] || [];
	packet.precedences[depth] = precedence;
	precedence.push(constr);
	packet.map[meta.namespace] = depth;
}

function applyMixin(precedences) {
	let proto = Object,
		outConstr = null,
		constructors = [];

	for (let a = precedences.length - 1; a >= 0; a--) {
		const precedence = precedences[a];

		for (let b = precedence.length - 1; b >= 0; b--) {
			const constr = precedence[b],
				meta = constr[META],
				p = toArr(meta.proto),
				protoProps = {},
				s = toArr(meta.static),
				staticProps = {};

			if (!a && !b) {
				outConstr = Function("constructors", "Manage", `
					var instantiate = Manage.instantiateAll.bind(null, constructors);
					return function ${meta.name}(options) { instantiate(this, options) }
				`)(constructors, Manage);
			} else
				outConstr = Function(`function ${meta.name}() {}; return ${meta.name};`)();

			outConstr.prototype = Object.create(proto.prototype);
			protoProps.constructor = createDescriptor(constr);
			protoProps[Manage.constructorSymbols[meta.namespace]] = createDescriptor(meta.constructorMethod);
			staticProps[META] = createDescriptor(constr[META]);

			for (let c = 0, l = p.length; c < l; c++)
				protoProps[p[c]] = createDescriptor(constr.prototype[p[c]]);

			for (let c = 0, l = s.length; c < l; c++)
				staticProps[s[c]] = createDescriptor(constr[s[c]]);

			Object.defineProperties(outConstr.prototype, protoProps);
			Object.defineProperties(outConstr, staticProps);

			constructors.push(outConstr);
			proto = outConstr;
		}
	}

	return outConstr;
}

function toArr(candidate) {
	if (!candidate)
		return [];

	return Array.isArray(candidate) ? candidate : [candidate];
}

function createDescriptor(value) {
	return {
		writable: true,
		enumerable: false,
		configurable: true,
		value
	};
}
