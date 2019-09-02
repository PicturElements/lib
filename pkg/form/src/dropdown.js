import Input from "./input";

export default class Dropdown extends Input {
	constructor(name, options, form) {
		super(name, options, form, {
			options: true,
			autoSet: true
		});
	}
}
