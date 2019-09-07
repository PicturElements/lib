export default function mkSTDLib(...libs) {
	class STDLib {
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
	}

	assign(STDLib.prototype, libs);

	return STDLib;
}

function assign(target, sources) {
	if (!sources)
		return;

	for (let i = 0, l = sources.length; i < l; i++) {
		const lib = sources[i];

		// Contrary to Object.assign, don't accept
		// non-object lib values
		if (!lib || lib.constructor != Object)
			continue;

		for (const k in lib) {
			if (!k || lib.hasOwnProperty(k))
				target[k] = lib[k];
		}
	}
}
