import { resolveVal } from "@qtxr/utils";
import Input, { INJECT } from "./input";

export default class Dropdown extends Input {
	constructor(name, options, form) {
		super(name, options, form, {
			options: "Array|function",
			cacheOptions: "boolean",
			searchFetch: "function",
			search: "function",
			searchRegexFlags: "string",
			searchOnExpand: "boolean",
			noSearch: "boolean",
			noAutoSearch: "boolean",
			noRefresh: "boolean",
			defer: "number",
			autoSet: "boolean",
			autoUpdate: "boolean"
		});
		this.pendingOptions = null;
		this.selectedIndex = -1;
		this.finishInit();
	}

	finishInit() {
		super.finishInit();
	}

	[INJECT](value) {
		if (typeof this.handlers.inject == "function")
			return super[INJECT](value);

		return this.resolveOptionSelection({
			value,
			resolve: runtime => {
				return typeof this.searchFetch == "function" ?
					resolveVal(this.searchFetch, runtime, {
						options: this.options,
						query: "",
						queryRegex: /(?:)/,
						fetched: false
					}, true) :
					resolveVal(this.options, runtime, true);
			}
		});
	}
}
