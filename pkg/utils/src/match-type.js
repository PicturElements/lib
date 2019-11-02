import {
	isConstructor,
	isNativeFunction
} from "./is";
import { getGlobalScope } from "./env";
import {
	composeOptionsTemplates,
	createOptionsObject
} from "./options";

const typesCache = {
	// typeof keys
	undefined: "undefined",
	boolean: "boolean",
	number: "number",
	bigint: "bigint",
	string: "string",
	symbol: "symbol",
	function: "function",
	object: "object",
	// match standard functions
	int: val => typeof val == "number" && !isNaN(val) && isFinite(val) && val % 1 == 0,
	uint: val => typeof val == "number" && !isNaN(val) && isFinite(val) && val % 1 == 0 && val >= 0,
	nullish: val => val == null,
	constructor: val => isConstructor(val),
	any: val => true
};

export default function matchType(val, type, options, forceFalseDefault = false) {
	options = createOptionsObject(options, optionsTemplates);

	if (typeof type == "string") {
		if (typesCache.hasOwnProperty(type))
			type = typesCache[type];
		else
			type = resolveType(type);
	}

	if (typeof type == "string")
		return typeof val == type;
	else if (typeof type == "function") {
		if (isConstructor(type)) {
			if (options.strictConstructor !== false)
				return val != null && val.constructor == type;
			
			return typeof val == "object" ? val instanceof type : val != null && val.constructor == type;
		}

		return Boolean(type(val));
	} else if (type && type.constructor == Array) {
		for (let i = type.length - 1; i >= 0; i--) {
			if (matchType(val, type[i], options, true))
				return true;
		}

		return false;
	}

	if (forceFalseDefault)
		return false;

	return options.hasOwnProperty("defaultMatch") ? options.defaultMatch : true;
}

function resolveType(signature) {
	const typeIds = signature.trim().split(/\s*\|\s*/),
		globalScope = getGlobalScope();
	let types = [];

	for (let i = 0, l = typeIds.length; i < l; i++) {
		const typeId = typeIds[i];

		if (typesCache.hasOwnProperty(typeId)) {
			types.push(typesCache[typeId]);
			continue;
		}

		const type = globalScope[typeId];

		if (!type || !isConstructor(type) || !isNativeFunction(type))
			throw new Error(`Failed to find a valid typeof value, cached type, or global constructor by ID '${typeId}' (in type signature '${signature})'`);

		types.push(type);
	}

	if (types.length < 2)
		types = types[0];

	typesCache[signature] = types;
	return types;
}

const optionsTemplates = composeOptionsTemplates({
	strictConstructor: true,
	noStrictConstructor: {
		strictConstructor: false
	},
	falseDefault: {
		defaultMatch: false
	},
	trueDefault: {
		defaultMatch: true
	}
});
