import hasOwn from "./has-own";
import { keys } from "./obj";
import { QNDSet } from "./internal/poly";
import {
	composeOptionsTemplates,
	createOptionsObject
} from "./internal/options";

let eqRuntime = {
	inexSet: null,
	lazy: false,
	circular: false
};

const REF_SET = new QNDSet();

function equals(valA, valB, options) {
	eqRuntime = createOptionsObject(options, optionsTemplates);
	return eq(valA, valB);
}

function eq(a, b) {
	if (typeof eqRuntime.comparator == "function") {
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

			if (eqRuntime.circular)
				REF_SET.add(a);

			let result;

			if (constr == Array)
				result = eqArray(a, b);
			else
				result = eqObject(a, b);

			if (eqRuntime.circular)
				REF_SET.delete(a);

			return result;
		}

		case "number":
			return isNaN(a) && isNaN(b);
	}

	return false;
}

function eqArray(a, b) {
	for (let i = a.length - 1; i >= 0; i--) {
		if (eqRuntime.circular && REF_SET.has(a[i]))
			continue;

		if (!eq(a[i], b[i]))
			return false;
	}

	return true;
}

function eqObject(a, b) {
	if (eqRuntime.lazy) {
		for (const k in a) {
			if (!hasOwn(a, k, false))
				continue;

			if (!hasOwn(b, k, false))
				return false;

			const recursive = !eqRuntime.circular || !REF_SET.has(a[k]);
			if (recursive && !eq(a[k], b[k]))
				return false;
		}
	} else {
		const ks = keys(a),
			ks2 = keys(b);

		if (ks.length != ks2.length)
			return false;

		for (let i = ks.length - 1; i >= 0; i--) {
			const k = ks[i];

			if (!hasOwn(b, k, false))
				return false;

			const recursive = !eqRuntime.circular || !REF_SET.has(a[k]);
			if (recursive && !eq(a[k], b[k]))
				return false;
		}
	}

	return true;
}

const optionsTemplates = composeOptionsTemplates({
	lazy: true,
	circular: true
});

export default equals;
