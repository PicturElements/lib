import Input from "./input";

export default class Checkbox extends Input {
	constructor(name, options, form) {
		super(name, options, form, {
			label: true
		});
	}
}
