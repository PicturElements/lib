import {
	get,
	resolveVal
} from "@qtxr/utils";
import BaseInput, { INJECT } from "./base-input";

export default class Dropdown extends BaseInput {
	constructor(name, options, form) {
		super(name, options, form, {
			options: "Array|function",
			cacheOptions: "boolean",
			searchFetch: "function",
			search: "function",
			searchRegexFlags: "string",
			searchOnExpand: "boolean",
			noSearch: "boolean",
			noRefresh: "boolean",
			defer: "number",
			autoSet: "boolean",
			autoUpdate: "boolean"
		});
		this.initFetchedOptions = null;
		this.selectedIndex = -1;
		this.finishInit();
	}

	finishInit() {
		super.finishInit();
	}

	[INJECT](value) {
		if (typeof this.handlers.inject == "function")
			return super[INJECT](value);
	
		const injectAccessor = typeof this.handlers.inject == "string" ?
				this.handlers.inject :
				this.handlers.extract,
			functionalSearchFetch = typeof this.searchFetch == "function";

		const dispatchValue = opts => {
			if (!Array.isArray(opts) || !opts.length)
				return value;

			for (let i = 0, l = opts.length; i < l; i++) {
				if (injectAccessor) {
					if (get(opts[i], injectAccessor) == value)
						return opts[i];
				} else if (this.compare(value, opts[i]))
					return opts[i];
			}

			return this.autoSet ? opts[0] : null;
		};
		
		if (value != null || this.autoSet) {
			const searchArgs = {
					options: this.options,
					query: "",
					queryRegex: /(?:)/,
					fetched: false
				},
				options = functionalSearchFetch ?
					resolveVal(this.searchFetch, searchArgs, true) :
					resolveVal(this.options, true);

			this.initFetchedOptions = options;

			if (options && typeof options.then == "function")
				return options.then(opts => dispatchValue(opts));

			return dispatchValue(options);
		}

		return null;
	}
}
