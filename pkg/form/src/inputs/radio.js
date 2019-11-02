import Input from "./input";

export default class Radio extends Input {
	constructor(name, options, form) {
		super(name, options, form, {
			options: Array,
			autoSet: "boolean"
		});
	}
}
