import BaseInput from "./base-input";

export default class Date extends BaseInput {
	constructor(name, options, form) {
		super(name, options, form, {
			range: "boolean"
		});
	}
}
