// Duplicates of utility functions from the package,
// put here to prevent circular dependency issues
import { POLYFILL_PREFIXES } from "../data/constants";
import supports from "../supports";

function isObject(val) {
	if (!val || typeof val != "object")
		return false;

	const proto = Object.getPrototypeOf(val);
	return proto == null || proto == Object.prototype;
}

function isPrimitive(val) {
	switch (typeof val) {
		case "object":
		case "function":
			return false;
	}

	return true;
}

function isValidObjectKey(key) {
	switch (typeof key) {
		case "string":
		case "symbol":
			return true;
	}

	return false;
}

const isSymbol = typeof Symbol == "undefined" ?
	candidate => typeof candidate == "string" && candidate.indexOf(POLYFILL_PREFIXES.symbol) == 0 :
	candidate => typeof candidate == "symbol";

const oHOP = Object.prototype.hasOwnProperty,
	hasOwn = (o, k) => oHOP.call(o, k);

const create = supports.features.nullProto ?
	Object.create :
	(proto, props) => {
		proto = proto == null ? {} : proto;
		return Object.create(proto, props);
	};

const assign = Object.assign ?
	Object.assign :
	(target, ...sources) => {
		// Fewer checks since this faces internal APIs
		for (let i = 0, l = sources.length; i < l; i++) {
			const source = sources[i];
			if (!isObject(source))
				continue;

			for (const k in source) {
				if (hasOwn(source, k))
					target[k] = source[k];
			}
		}

		return target;
	};

export {
	isObject,
	isPrimitive,
	isValidObjectKey,
	isSymbol,
	hasOwn,
	create,
	assign
};
