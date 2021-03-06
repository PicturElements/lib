import { Hookable } from "@qtxr/bc";
import {
	uid,
	get,
	hasOwn,
	inject,
	matchQuery,
	cleanRegex,
	isPrimitive,
	composeOptionsTemplates,
	createOptionsObject
} from "@qtxr/utils";
import Input from "../inputs/input";

// OptionsContext
// OptionsContext abstracts data flow when searching/manipulating options in dropdowns, etc
//
// Config
// name			string				Identifying name for reference in slots, etc
//									This value is not inheritable
// options		array|function		Options source. Resolved to an option array internally
// search		function|string		Search function. This is run on resolved options, that is,
//									an array of options from either an array or functional source
//									A singular runtime object is provided as the argument
//									The expected return value is a boolean describing whether to
//									make the option visible
//									If this is a string, it acts as an accessor which is used to
//									access data in the option
//									If no value is provided, or if an accessor is used, the search
//									query is converted to a regular expression and run on the option
//									If no value is provided, an accessor can also be inherited from
//									the input (inject/extract)
// flags		string				Regex flags to apply during search
// searchFetch	function			Fetcher function. If this is used, the task of fetching options and running
//									search on them is deferred to it. All options returned are visible
// deepSearch	boolean				Coming soon - runs the search on all options and their children
// nest			boolean				Whether to treat applicable option nodes as nestable search options
//									This is set to true by default, so if a node's 'children' property is an
//									array or function, it will automatically be converted to a wrapped
//									OptionsContext node
// hash			function			Hasher function. Used to quickly identify options. This is used when the active
//									option is being determined. Called with a singular runtime argument
// cache		boolean				Static/dynamic cache for options. If searchFetch is used, the cache is considered
//									dynamic, where options are cached according to
//									Cache search data by search query. This is overridden if search is refreshed
//									By default, this is set to true
// inherit		boolean				Whether to inherit parent config in child instances of OptionsContext
//									By default, this is set to true
// expanded		boolean				Default state of the option. If true, the child options will be rendered when
//									the parent node is rendered. Note that this will also trigger search
//
// Processed option structure
// uid			string				Unique option identifier
// type			string				The option type. "leaf" for normal options, "context" for OptionsContext option
// context		OptionsContext		The closest OptionsContext instance. For leaf nodes, it's the parent instance,
//									and for context nodes it's the corresponding OptionsContext instance
// value		any					Option value
// visible		boolean				Option visibility
// name								Corresponds to the parent context name
// selected		boolean				Whether the option is currently selected - leaf node only
// select		function			Select the option - leaf node only
// deselect		function			Deselect the option - leaf node only

const BASE_CONFIG_SCHEMA = {
		options: "Array|function",
		search: "function|string",
		flags: "string",
		searchFetch: "function",
		deepSearch: "boolean",
		nest: "boolean",
		hash: "function",
		cache: "boolean",
		inherit: "boolean",
		expanded: "boolean"
	},
	FULL_CONFIG_SCHEMA = Object.assign({
		name: "string",
		noSearch: "boolean|function"
	}, BASE_CONFIG_SCHEMA);

const configTemplates = composeOptionsTemplates({
	nest: true,
	cache: true,
	inherit: true
});

let id = 0;

export default class OptionsContext extends Hookable {
	constructor(input, config, globalConfig = {}, parent = null) {
		super({
			hookable: {
				noOwnerArg: true
			}
		});

		config = inject(
			{},
			createOptionsObject(config, configTemplates),
			{
				schema: FULL_CONFIG_SCHEMA,
				strictSchema: true
			}
		);

		if (!config.name)
			config.name = `options-context-${id++}`;

		this.input = input;
		this.config = config.inherit !== false && parent ?
			inject(config, parent.config, {
				ignore: {
					options: true
				}
			}) :
			config;
		this.globalConfig = globalConfig;

		if (this.config.search === undefined)
			this.config.search = input.inferAccessor();
		if (this.config.hash === undefined)
			this.config.hash = input.handlers.hash;
		this.config.hash = Input.mkHasher(input, this.config.hash);

		this.root = parent ?
			parent.root :
			this;
		this.parent = parent;

		this.state = {
			query: "",
			lastQuery: null,
			loaded: false,
			loading: false,
			error: false,
			errorMsg: "",
			fetches: 0
		};
		this.cache = {
			static: null,
			dynamic: {}
		};
		this.debounce = {
			hash: null,
			stagingPromise: null,
			stagingResolve: null,
			responses: {},
			pending: {},
			dispatch: response => {
				const d = this.debounce,
					res = d.stagingResolve;

				d.hash = null;
				d.stagingPromise = null;
				d.stagingResolve = null;
				d.responses = {};
				d.pending = {};

				this._dispatchSearchResponse(response);
				res(response.options);
			}
		};
		this.path = parent ?
			parent.path.concat(this.config.name) :
			[this.config.name];

		this.options = [];
		this.hashedOptions = {};
		this.length = 0;

		// Root level only
		if (!parent) {
			this.selection = [];
			this.hashedSelection = {};
		}
	}

	search(query = null, refresh = false, inquisitive = false) {
		if (typeof query == "boolean") {
			inquisitive = refresh;
			refresh = query;
			query = null;
		}

		if (typeof query != "string")
			query = this.parent ? this.parent.state.query : "";

		const hash = this._getSearchHash(query, refresh, inquisitive),
			d = this.debounce;

		if (!d.hash) {
			d.stagingPromise = new Promise(resolve => {
				d.stagingResolve = resolve;
			});
		}

		if (hasOwn(d.responses, hash))
			d.dispatch(d.responses[hash]);
		else if (!hasOwn(d.pending, hash)) {
			d.hash = hash;
			d.pending[hash] = true;
			this._search(query, refresh, inquisitive)
				.then(response => {
					if (d.hash == hash)
						d.dispatch(response);
					else
						d.responses[hash] = response;
				});
		}

		return d.stagingPromise;
	}

	_getSearchHash(query = null, refresh = false, inquisitive = false) {
		const rKey = refresh ? "r" : "x",
			iKey = inquisitive ? "i" : "x",
			defaultHash = `${rKey}${iKey}:${query}`,
			strongHash = `r${iKey}:${query}`,
			d = this.debounce;

		if (hasOwn(d.pending, strongHash))
			return strongHash;

		return defaultHash;
	}

	async _search(query = null, refresh = false, inquisitive = false) {
		this.state.query = query;
		this.state.loading = true;
		this.state.error = false;
		this.state.errorMsg = "";
		this.callHooks("fetching", this.state);

		const searchRegexFlags = typeof this.config.flags == "string" ?
				this.config.flags :
				"i",
			queryRegex = new RegExp(cleanRegex(query), searchRegexFlags),
			runtime = this.input.mkRuntime({
				refresh,
				options: null,
				hashedOptions: null,
				option: null,
				query,
				queryRegex,
				fetched: false
			}),
			pendingSearches = [],
			useSearchFetch = typeof this.config.searchFetch == "function",
			useFunctionalSearch = typeof this.config.search == "function",
			useAccessorSearch = typeof this.config.search == "string",
			useRawSearch = !useSearchFetch && !useFunctionalSearch && !useAccessorSearch && !this.input.res(this.config.noSearch),
			performSearch = Boolean(useFunctionalSearch && !useSearchFetch) || useAccessorSearch || useRawSearch,
			useDynamicCache = useSearchFetch,
			cached = this.config.cache === false || refresh ?
				null :
				useDynamicCache ? this.cache.dynamic[query] : this.cache.static,
			response = {
				success: true,
				query,
				cached,
				refresh,
				runtime,
				queryRegex,
				inquisitive,
				useSearchFetch,
				useFunctionalSearch,
				useAccessorSearch,
				useRawSearch,
				performSearch,
				useDynamicCache,
				options: null,
				hashedOptions: null,
				length: 0
			};

		let options = this.config.options,
			hashedOptions = null,
			length = 0;

		if (cached) {
			options = cached.options;
			hashedOptions = cached.hashedOptions;
			length = cached.length;

			if (useDynamicCache && this.state.lastQuery != null && query != this.state.lastQuery)
				this.collapseOptions(options);
		} else if (useSearchFetch)
			options = await this.config.searchFetch(runtime);
		else if (typeof options == "function")
			options = await options(runtime);

		if (!Array.isArray(options)) {
			response.success = false;
			response.options = options;
			return response;
		}

		runtime.options = options;

		if (cached && inquisitive) {
			for (let i = 0, l = options.length; i < l; i++) {
				if (options[i].type != "context")
					continue;

				pendingSearches.push(
					options[i].context.search(refresh, inquisitive)
				);
			}
		} else if (!cached) {
			const processedOptions = [],
				hashed = {};

			for (let i = 0, l = options.length; i < l; i++) {
				const option = isOptionConfig(options[i]) ?
					Object.assign({}, options[i]) :
					{ value: options[i] };

				if (!hasOwn(option, "value"))
					option.value = options[i];

				if (this.config.nest !== false && isContextConfig(option)) {
					option.type = "context";
					const { _, ...opt } = option;
					option.context = new OptionsContext(this.input, opt, this.globalConfig, this);

					if (option.context.config.expanded || inquisitive) {
						pendingSearches.push(
							option.context.search(refresh, inquisitive)
						);
					}
				} else {
					option.type = "leaf";
					option.context = this;
				}

				option.uid = uid(12);
				option.visible = true;
				option.hash = this.config.hash(option.value);
				option.owner = this;

				if (option.hash)
					hashed[option.hash] = option;
				processedOptions.push(option);

				if (option.type == "leaf") {
					option.selected = this.updateOption(option);
					option.select = _ => this.selectOption(option);
					option.deselect = _ => this.deselectOption(option);
				} else {
					option.defaultExpanded = option.expanded || false;
					option.expanded = option.expanded || false;
				}
			}

			options = processedOptions;
			hashedOptions = hashed;
			length = options.length;
		}

		runtime.hashedOptions = hashedOptions;

		if (pendingSearches.length)
			await Promise.all(pendingSearches);

		response.options = options;
		response.hashedOptions = hashedOptions;
		response.length = length;
		return response;
	}

	_dispatchSearchResponse(response) {
		const {
			success,
			query,
			cached,
			runtime,
			queryRegex,
			useSearchFetch,
			useFunctionalSearch,
			useAccessorSearch,
			performSearch,
			useDynamicCache,
			options,
			hashedOptions
		} = response;
		let { length } = response;

		if (!success) {
			this.state.error = true;

			if (typeof options == "string")
				this.state.errorMsg = options;

			this.callHooks("error", this.state);
			return null;
		}

		if (this.config.cache !== false) {
			if (useDynamicCache)
				this.cache.dynamic[query] = response;
			else
				this.cache.static = response;
		}

		// Unless search is done via searchFetch (meaning that all options are
		// fetched anew for every search, meaning that keeping track of selections
		// is unviable), validate selection
		if (!cached && !useSearchFetch) {
			const selection = this.root.selection;
			for (let i = 0, l = selection.length; i < l; i++) {
				const opt = selection[i];
				let found = false;

				if (opt.owner != this)
					continue;

				for (let i = 0, l = options.length; i < l; i++) {
					if (this.compareOptions(options[i], opt)) {
						found = true;
						break;
					}
				}

				if (!found)
					this.deselectOption(opt);
			}
		}

		if (performSearch) {
			length = 0;

			for (let i = 0, l = options.length; i < l; i++) {
				const option = options[i];

				if (useFunctionalSearch) {
					runtime.option = option.value;
					option.visible = Boolean(this.config.search(runtime));
				} else if (useAccessorSearch) {
					const testVal = get(option.value, this.config.search);

					if (!isPrimitive(testVal))
						console.warn("Search value is not primitive", testVal);

					option.visible = queryRegex.test(String(testVal));
				} else {
					if (!isPrimitive(option.value))
						console.warn("Search value is not primitive", option.value);

					option.visible = queryRegex.test(String(option.value));
				}

				if (option.visible)
					length++;
			}
		}

		this.options = options;
		this.hashedOptions = hashedOptions;
		this.length = length;

		this.state.lastQuery = query;
		this.state.loading = false;
		this.state.fetches++;
		this.callHooks("fetched", this.state);
		return response;
	}

	collapseOptions(opts = this.options) {
		const reset = options => {
			if (!options)
				return;

			for (let i = 0, l = options.length; i < l; i++) {
				const option = options[i];
				if (option.type != "context")
					continue;

				option.expanded = option.defaultExpanded;
				reset(option.context.options);
			}
		};

		reset(opts);
		this.callHooks("reset");
	}

	callHooks(partitionName, ...args) {
		super.callHooks(
			partitionName,
			this.input.mkRuntime({
				partitionName,
				context: this,
				options: this.root.options,
				selection: this.root.selection
			}),
			...args
		);
	}

	compareOptions(option, option2) {
		if (option == option2)
			return true;

		if (option.hash != null)
			return option.hash == option2.hash;

		const comparison = this.input.compare(option.value, option2.value);
		if (typeof comparison == "number")
			return !comparison;
		return Boolean(comparison);
	}

	getSelectedOptionIndex(option, getExistence = false) {
		const root = this.root;

		if (option.hash != null) {
			if (!hasOwn(root.hashedSelection, option.hash))
				return -1;
			else if (getExistence)
				return Infinity;
		}

		for (let i = 0, l = root.selection.length; i < l; i++) {
			if (this.compareOptions(option, root.selection[i]))
				return i;
		}

		return -1;
	}

	hasSelectedOption(option) {
		return this.root.getSelectedOptionIndex(option, true) > -1;
	}

	selectOption(option) {
		if (!option)
			return false;
		if (option.selected)
			return true;

		const root = this.root;
		option.selected = true;

		if (this.hasSelectedOption(option))
			return false;

		if (this.globalConfig.maxSelected && root.selection.length == this.globalConfig.maxSelected)
			this.deselectOption(root.selection[0]);
		if (option.hash != null)
			root.hashedSelection[option.hash] = option;

		root.selection.push(option);
		this.callHooks("select", option);
		return true;
	}

	deselectOption(option) {
		if (!option)
			return false;
		if (!option.selected)
			return true;

		const root = this.root;
		option.selected = false;

		if (option.hash != null && !hasOwn(root.hashedSelection, option.hash))
			return false;

		const idx = this.getSelectedOptionIndex(option);
		if (idx == -1)
			return false;

		const opt = root.selection.splice(idx, 1)[0];
		if (option.hash != null)
			delete root.hashedSelection[option.hash];

		this.callHooks("deselect", opt);
		return true;
	}

	updateOption(option) {
		const idx = this.getSelectedOptionIndex(option);
		if (idx == -1)
			return false;

		if (option.hash != null)
			this.root.hashedSelection[option.hash] = option;

		this.root.selection[idx] = option;
		return true;
	}

	getSelection() {
		const root = this.root,
			selection = [];

		for (let i = 0, l = root.selection.length; i < l; i++)
			selection.push(root.selection[i].value);

		return selection;
	}

	clear() {
		const root = this.root;

		for (let i = root.selection.length - 1; i >= 0; i--)
			this.deselectOption(root.selection[i]);
	}
}

function isOptionConfig(candidate) {
	return matchQuery(candidate, BASE_CONFIG_SCHEMA, "typed|lazy");
}

function isContextConfig(candidate) {
	if (candidate.nest === false)
		return false;

	return matchQuery(candidate, BASE_CONFIG_SCHEMA, "typed|lazy");
}
