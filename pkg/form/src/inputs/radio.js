import BaseInput from "./base-input";

export default class Radio extends BaseInput {
	constructor(name, options, form) {
		super(name, options, form, {
			options: Array,
			autoSet: "boolean"
		});
	}
}
