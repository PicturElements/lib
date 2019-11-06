import BaseInput from "./base-input";

export default class Dropdown extends BaseInput {
	constructor(name, options, form) {
		super(name, options, form, {
			options: Array,
			autoSet: "boolean"
		});
	}
}
