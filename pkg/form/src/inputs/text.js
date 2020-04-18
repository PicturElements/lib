import Input from "./input";

export default class Text extends Input {
	constructor(name, options, form) {
		super(name, options, form, {
			maxLength: "uint"
		});
	}
}
