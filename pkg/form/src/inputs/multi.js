import BaseInput from "./base-input";

export default class Multi extends BaseInput {
	constructor(name, options, form) {
		super(name, options, form, {
			options: "Array|function",
			search: "function",
			maxSearchResults: "number",
			noSearch: "boolean"
		});

		this.value = this.value || [];
	}
}
