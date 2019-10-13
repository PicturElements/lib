import { sym } from "./sym";

// STDLib making function. Leverages the prototype chain to prevent
// needlessly having to Object.assign new clean objects every time
// an object with standard methods/fields is needed

const stdNameSym = sym("standard library name");

export default function mkStdLib(name, ...libs) {
	if (typeof name != "string" || name == "StdLib")
		return mkAnonymousStdLib(name, ...libs);

	// Only do this because it may be useful for clarity
	// to have STDLib instances have a descriptive name
	const constr = Function("assign", `return function ${name}() { assign(this, arguments); }`)(assign);

	constr.add = (key, val) => {
		if (!key || typeof key != "string")
			return console.warn(`Cannot add ${name} function: ${key} is not a valid key`);

		constr.prototype[key] = val;
	};

	constr.remove = key => {
		if (constr.prototype.hasOwnProperty(key))
			return delete constr.prototype[key];

		return false;
	};

	constr.has = (instOrKey, key) => {
		if (isStdLib(instOrKey))
			return instOrKey.hasOwnProperty(key) || constr.prototype.hasOwnProperty(key);

		return constr.prototype.hasOwnProperty(instOrKey);
	};

	constr[stdNameSym] = name;
	assign(constr.prototype, libs);

	return constr;
}

function mkAnonymousStdLib(...libs) {
	class StdLib {
		constructor(...extend) {
			assign(this, extend);
		}
	
		static add(key, val) {
			if (!key || typeof key != "string")
				return console.warn(`Cannot add STDLib function: ${key} is not a valid key`);
	
			this.prototype[key] = val;
		}
	
		static remove(key) {
			if (this.prototype.hasOwnProperty(key))
				return delete this.prototype[key];
	
			return false;
		}

		static has(instOrKey, key) {
			if (isStdLib(instOrKey))
				return instOrKey.hasOwnProperty(key) || this.prototype.hasOwnProperty(key);

			return this.prototype.hasOwnProperty(instOrKey);
		}	
	}

	StdLib[stdNameSym] = "StdLib";
	assign(StdLib.prototype, libs);

	return StdLib;
}

function assign(target, sources) {
	if (!sources)
		return;

	for (let i = 0, l = sources.length; i < l; i++) {
		const source = sources[i];

		// Unlike to Object.assign, don't accept
		// non-object lib values
		if (!source || source.constructor != Object)
			continue;

		for (const k in source) {
			if (!k || source.hasOwnProperty(k))
				target[k] = source[k];
		}
	}
}

function isStdLib(candidate) {
	return Boolean(candidate) && candidate.hasOwnProperty(stdNameSym);
}
