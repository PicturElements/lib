import hasOwn from "./has-own";
import { keys } from "./obj";
import {
	composeOptionsTemplates,
	createOptionsObject
} from "./options";

let eqRuntime = {
	lazy: false
};

function equals(valA, valB, options) {
	eqRuntime = createOptionsObject(options, equalsTemplates);
	return eq(valA, valB);
}

function eq(a, b) {
	if (eqRuntime.comparator && typeof eqRuntime.comparator == "function") {
		const cmp = eqRuntime.comparator(a, b);

		if (typeof cmp == "boolean")
			return cmp;
	}

	if (a === b)
		return true;
		
	// if a is null/undefined, that means b cannot be
	// the same, as that should've passed a === b
	if (a == null || b == null || typeof a != typeof b)
		return false;

	switch (typeof a) {
		case "object": {
			if (a.length !== b.length)
				return false;

			const constr = a.constructor;
			if (constr != b.constructor)
				return false;

			if (constr == Array)
				return eqArray(a, b);
			else
				return eqObject(a, b);

			break;
		}

		case "number":
			return isNaN(a) && isNaN(b);
	}

	return false;
}

function eqArray(a, b) {
	for (let i = a.length - 1; i >= 0; i--) {
		if (!eq(a[i], b[i]))
			return false;
	}

	return true;
}

function eqObject(a, b) {
	if (eqRuntime.lazy) {
		for (const k in a) {
			if ((hasOwn(a, k) && !hasOwn(b, k)) || !eq(a[k], b[k]))
				return false;
		}
	} else {
		const ks = keys(a),
			ks2 = keys(b);

		if (ks.length != ks2.length)
			return false;

		for (let i = ks.length - 1; i >= 0; i--) {
			const k = ks[i];

			if (!hasOwn(b, k) || !eq(a[k], b[k]))
				return false;
		}
	}

	return true;
}

const equalsTemplates = composeOptionsTemplates({
	lazy: true
});

export default equals;
