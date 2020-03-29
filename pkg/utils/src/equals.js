import hasOwn from "./has-own";
import { keys, extend } from "./obj";
import {
	composeOptionsTemplates,
	createOptionsObject
} from "./options";
import { QNDSet } from "./internal/poly";
import { sym } from "./sym";
import { isObj } from "./is";

// TODO: remove runtime object and make
// structurally similar to clone and inject

let eqRuntime = {
	inexSet: null,
	lazy: false,
	circular: false
};

const equalSym = sym("equal");

function equals(valA, valB, options) {
	eqRuntime = Object.assign({
		inexSet: new QNDSet()
	}, createOptionsObject(options, optionsTemplates));
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
				extend(a, equalSym, true, _ => eqRuntime.inexSet.add(a));

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
		if (eqRuntime.circular && isObj(a[i])) {
			if (hasOwn(a[i], equalSym))
				continue;

			if (!Object.isExtensible(a[i]) && eqRuntime.inexSet.has(a[i]))
				continue;
		}

		if (!eq(a[i], b[i]))
			return false;
	}

	return true;
}

function eqObject(a, b) {
	if (eqRuntime.lazy) {
		for (const k in a) {
			let recursive = true;

			if ((hasOwn(a, k, false) && !hasOwn(b, k, false)))
				return false;

			if (eqRuntime.circular && isObj(a[k])) {
				if (hasOwn(a[k], equalSym))
					recursive = false;
				else if (!Object.isExtensible(a[k]) && eqRuntime.inexSet.has(a[k]))
					recursive = false;
			}

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
			let recursive = true;

			if (eqRuntime.circular && isObj(a[k])) {
				if (hasOwn(a[k], equalSym))
					recursive = false;
				else if (!Object.isExtensible(a[k]) && eqRuntime.inexSet.has(a[k]))
					recursive = false;
			}

			if (!hasOwn(b, k, false) || (recursive && !eq(a[k], b[k])))
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
