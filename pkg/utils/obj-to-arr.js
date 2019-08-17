import resolveArgs from "./resolve-args";

// allowNonexistent - inject property values for
// properties that don't exist on the object
const objToArrParamSignature = [
	{ name: "obj", type: "object", required: true},
	{ name: "order", type: Array },
	{ name: "processor", type: "function", default: (val, key, obj) => val },
	{ name: "allowNonexistent", type: "boolean", default: true }
];

export default function objToArr(...args) {
	let {
		obj,
		order,
		processor,
		allowNonexistent
	} = resolveArgs(args, objToArrParamSignature, "objToArr");

	order = order || obj._order;

	if (Array.isArray(obj))
		return obj.map(processor);

	const out = [];

	if (order) {
		for (let i = 0, l = order.length; i < l; i++) {
			if (obj.hasOwnProperty(order[i]) || allowNonexistent)
				out.push(processor(obj[order[i]], order[i], obj));
		}
	} else {
		for (const k in obj) {
			if (obj.hasOwnProperty(k))
				out.push(processor(obj[k], k, obj));
		}
	}

	return out;
}
