import BaseInput from "./base-input";

export default class DateTime extends BaseInput {
	constructor(name, options, form) {
		super(name, options, form, {
			meridiem: "boolean",
			range: "boolean"
		});
	}
}
