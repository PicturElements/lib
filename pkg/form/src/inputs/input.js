import BaseInput from "./base-input";

export default class Input extends BaseInput {
	constructor(name, options, form) {
		super(name, options, form, {
			maxLength: "uint"
		});
	}
}
