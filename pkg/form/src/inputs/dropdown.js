import { resolveVal } from "@qtxr/utils";
import Input, { INJECT } from "./input";
import OptionsContext from "../assets/options-context";

export default class Dropdown extends Input {
	constructor(name, options, form) {
		super(name, options, form, {
			options: "Array|function",
			search: "function|string",
			searchFetch: "function",
			cacheOptions: "boolean",
			flags: "string",
			searchOnExpand: "boolean",
			noSearch: "boolean",
			noAutoSearch: "boolean",
			noRefresh: "boolean",
			defer: "number",
			autoSet: "boolean",
			autoUpdate: "boolean",
			nest: "boolean",
			cache: "boolean",
			inherit: "boolean"
		});
		this.pendingOptions = null;
		this.selectedIndex = -1;
		this.optionsContext = null;
		this.finishInit();
	}

	finishInit() {
		super.finishSetup();
		this.optionsContext = new OptionsContext(this, {
			name: this.name,
			options: this.options,
			search: this.search,
			flags: this.flags,
			searchFetch: this.searchFetch,
			nest: this.nest,
			hash: val => this.hash(val),
			cache: this.cache,
			inherit: this.inherit
		}, {
			maxSelected: 1
		});
		super.initValue();
	}

	async [INJECT](value) {
		if (typeof this.handlers.inject == "function")
			return super[INJECT](value);

		const option = await this.resolveOptionSelection({
			value,
			resolve: _ => this.optionsContext.search(""),
			resolveOptionValue: opt => opt.value
		});

		if (option && option != value)
			this.optionsContext.selectOption(option);

		return option ?
			option.value :
			value;
	}
}
