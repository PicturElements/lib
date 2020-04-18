import Input from "./input";

export default class Multi extends Input {
	constructor(name, options, form) {
		super(name, options, form, {
			options: "Array|function",
			cacheOptions: "boolean",
			searchFetch: "function",
			search: "function",
			searchRegexFlags: "string",
			searchOnExpand: "boolean",
			maxSearchResults: "number",
			noSearch: "boolean",
			noRefresh: "boolean",
			defer: "number",
			max: "number"
		});

		this.value = this.value || [];
	}
}
