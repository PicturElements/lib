import {
	get,
	resolveVal
} from "@qtxr/utils";
import BaseInput, { INJECT } from "./base-input";

export default class Dropdown extends BaseInput {
	constructor(name, options, form) {
		super(name, options, form, {
			options: Array,
			autoSet: "boolean"
		});
	}

	[INJECT](value) {
		if (typeof this.inject == "function")
			return super[INJECT](value);

		const options = resolveVal(this.options, this),
			injectAccessor = typeof this.inject == "string" ? this.inject : this.extract;

		if (!Array.isArray(options) || typeof injectAccessor != "string")
			return value;

		for (let i = 0, l = options.length; i < l; i++) {
			if (this.compare(get(options[i], injectAccessor), value))
				return options[i];
		}

		return value;
	}
}
