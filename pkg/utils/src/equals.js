import hasOwn from "./has-own";
import { keys } from "./obj";
import {
	composeOptionsTemplates,
	createOptionsObject
} from "./options";
import { sym } from "./sym";
import { isObj } from "./is";

// TODO: remove runtime object and make equals
// structurally similar to clone and inject

let eqRuntime = {
	lazy: false,
	circular: false
};

const equalSym = sym("equal");

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
				a[equalSym] = true;

			let result;

			if (constr == Array)
				result = eqArray(a, b);
			else
				result = eqObject(a, b);

			if (eqRuntime.circular)
				delete a[equalSym];

			return result;
		}

		case "number":
			return isNaN(a) && isNaN(b);
	}

	return false;
}

function eqArray(a, b) {
	for (let i = a.length - 1; i >= 0; i--) {
		if (eqRuntime.circular && isObj(a[i]) && hasOwn(a[i], equalSym, true))
			continue;

		if (!eq(a[i], b[i]))
			return false;
	}

	return true;
}

function eqObject(a, b) {
	if (eqRuntime.lazy) {
		for (const k in a) {
			const recursive = !eqRuntime.circular || !(isObj(a[k]) && hasOwn(a[k], equalSym, true));

			if ((hasOwn(a, k) && !hasOwn(b, k)) || (recursive && !eq(a[k], b[k])))
				return false;
		}
	} else {
		const ks = keys(a),
			ks2 = keys(b);

		if (ks.length != ks2.length)
			return false;

		for (let i = ks.length - 1; i >= 0; i--) {
			const k = ks[i],
				recursive = !eqRuntime.circular || !(isObj(a[k]) && hasOwn(a[k], equalSym, true));

			if (!hasOwn(b, k) || (recursive && !eq(a[k], b[k])))
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
