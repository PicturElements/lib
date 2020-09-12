// An input group proxy is an array of inputs with the same name
// Its task is to provide a subset of the functionality offered by
// individual inputs, but operates under a few select rules:
// 1. Only existing inputs are considered by default
//	  A proxy only operates on inputs that exist
//	  to both save processing and to make working with the most
//	  common use case for same-name inputs, conditional rendering,
//	  intuitive. An existing input is an input that is known to the
//	  parent form, but which may still not be visible to the user
// 2. To override this default behavior, prepend .all to every
//	  method call or data access. This will prompt the proxy to
//	  consider all inputs, hidden or not, in calculations

export default class InputGroupProxy extends Array {
	constructor(...args) {
		super(...args);
		this._all = false;
	}

	forEach(callback, forAll = this._all) {
		for (let i = 0, l = this.length; i < l; i++) {
			const inp = this[i];
			if (!forAll && !inp.exists)
				continue;

			if (callback(inp, i, this) === false)
				return false;
		}

		this._all = false;
		return true;
	}

	map(callback, forAll = this._all) {
		const target = [];

		for (let i = 0, l = this.length; i < l; i++) {
			const inp = this[i];
			if (!forAll && !inp.exists)
				continue;

			target.push(callback(inp, i, this));
		}

		this._all = false;
		if (forAll)
			return target;
		if (!target.length)
			return null;
		return target[0];
	}

	some(callback, forAll = this._all) {
		return !this.forEach((inp, idx) => !callback(inp, idx, this), forAll);
	}

	every(callback, forAll = this._all) {
		return this.forEach((inp, idx) => Boolean(callback(inp, idx, this)), forAll);
	}

	refresh() {
		this.forEach(inp => inp.refresh());
	}

	val(format = null) {
		return this.map(inp => inp.val(format));
	}

	get all() {
		this._all = true;
		return this;
	}

	get value() {
		return this.map(inp => inp.value);
	}

	set value(val) {
		console.warn("InputGroupProxy value is read-only", val);
		this._all = false;
	}

	get values() {
		return this.map(inp => inp.value, true);
	}

	set values(val) {
		console.warn("InputGroupProxy values are read-only", val);
		this._all = false;
	}

	get changed() {
		return this.every(inp => inp.changed);
	}

	set changed(changed) {
		this.forEach(inp => inp.changed = changed);
	}

	get valid() {
		return this.every(inp => inp.valid);
	}

	set valid(valid) {
		this.forEach(inp => inp.valid = valid);
	}
}
