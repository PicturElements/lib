import BaseInput, { INJECT } from "./base-input";

export default class Time extends BaseInput {
	constructor(name, options, form) {
		super(name, options, form, {
			meridiem: "boolean",
			range: "boolean"
		});
	}

	[INJECT](value) {
		if (typeof this.inject == "function")
			return this.inject(value);

		if (this.range) {
			if (Array.isArray(value))
				return value;

			return [value, value];
		} else {
			if (Array.isArray(value))
				return value[0];
			
			return value;
		}
	}
}
