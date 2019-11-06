import BaseInput from "./base-input";

export default class TextArea extends BaseInput {
	constructor(name, options, form) {
		super(name, options, form, {
			maxLength: "uint"
		});
	}
}
