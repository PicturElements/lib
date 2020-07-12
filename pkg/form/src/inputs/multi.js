import Input, {
	INJECT,
	REFRESH,
	MERGE_INJECT
} from "./input";
import OptionsContext from "../assets/options-context";

export default class Multi extends Input {
	constructor(name, options, form) {
		super(name, options, form, {
			options: "Array|function",
			search: "function|string",
			searchFetch: "function",
			cacheOptions: "boolean",
			flags: "string",
			searchOnExpand: "boolean",
			noSearch: "boolean|function",
			noAutoSearch: "boolean",
			noRefresh: "boolean",
			defer: "number",
			nest: "boolean",
			cache: "boolean",
			inherit: "boolean",
			max: "number"
		});
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
			inherit: this.inherit,
			noSearch: this.noSearch
		}, {
			maxSelected: this.max || Infinity
		});
		super.initValue();
	}

	async [INJECT](value) {
		if (typeof this.handlers.inject == "function")
			return super[INJECT](value);

		this.optionsContext.clear();

		const selection = [];
		const res = await this.resolveOptionSelection({
			value,
			resolve: _ => this.optionsContext.search(this.optionsContext.state.query, false, true),
			resolveOptionValue: opt => opt.value,
			singular: false
		});

		this.clearPendingValue();

		for (let i = 0, l = res.selection.length; i < l; i++) {
			this.optionsContext.selectOption(res.selection[i]);
			selection.push(res.selection[i].value);
		}

		return selection;
	}

	[MERGE_INJECT](value) {
		if (!Array.isArray(value))
			return [];

		const selection = [];

		for (let i = 0, l = value.length; i < l; i++)
			selection.push(value[i].value);

		return selection;
	}

	[REFRESH]() {
		super[REFRESH]();

		this.resolvePendingValue(async resolved => {
			const res = await this.resolveOptionSelection({
				value: resolved,
				resolve: _ => this.optionsContext.search(this.optionsContext.state.query, true),
				resolveOptionValue: opt => opt.value,
				singular: false
			});

			if (res.success)
				await this.setValue(res.selection);
			else
				await this.setValue(null);
		});
	}
}
