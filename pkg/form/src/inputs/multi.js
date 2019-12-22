import BaseInput from "./base-input";

export default class Multi extends BaseInput {
	constructor(name, options, form) {
		super(name, options, form, {
			options: "Array|function",
			searchFetch: "function",
			search: "function",
			searchRegexFlags: "string",
			maxSearchResults: "number",
			noSearch: "boolean",
			defer: "number",
			max: "number"
		});

		this.value = this.value || [];
	}
}
