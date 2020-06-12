import Input, {
	INJECT,
	REFRESH,
	DISPATCH_VALUE
} from "./input";
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
			noSearch: "boolean|function",
			noAutoSearch: "boolean",
			noRefresh: "boolean",
			defer: "number",
			autoSet: "boolean",
			autoUpdate: "boolean",
			nest: "boolean",
			cache: "boolean",
			inherit: "boolean"
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
			maxSelected: 1
		});
		super.initValue();
	}

	async [INJECT](value) {
		if (typeof this.handlers.inject == "function")
			return super[INJECT](value);

		const res = await this.resolveOptionSelection({
			value,
			resolve: _ => this.optionsContext.search(this.optionsContext.state.query),
			resolveOptionValue: opt => opt.value
		});

		if (res.option) {
			this.clearPendingValue();
			this.optionsContext.selectOption(res.option);
			return res.option.value;
		}

		this.setPendingValue(value);
		return value;
	}

	[REFRESH]() {
		super[REFRESH]();

		this.resolvePendingValue(async resolved => {
			const res = await this.resolveOptionSelection({
				value: resolved,
				resolve: _ => this.optionsContext.search(this.optionsContext.state.query, true),
				resolveOptionValue: opt => opt.value
			});

			if (res.success)
				await this.setValue(res.option.value);
			else
				await this.setValue(null);
		});
	}

	[DISPATCH_VALUE](value, oldValue) {
		super[DISPATCH_VALUE](value, oldValue);
		if (value === null)
			this.optionsContext.clear();
	}
}
