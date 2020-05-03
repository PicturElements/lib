import { Hookable } from "@qtxr/bc";
import {
	get,
	hasOwn,
	inject,
	matchQuery,
	cleanRegex,
	isPrimitive,
	composeOptionsTemplates,
	createOptionsObject
} from "@qtxr/utils";

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
	OPTION_CONFIG_SCHEMA = Object.assign({
		value: v => v != null
	}, BASE_CONFIG_SCHEMA),
	FULL_CONFIG_SCHEMA = Object.assign({
		name: "string"
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
			inject(config, parent.config) :
			config;
		this.globalConfig = globalConfig;

		if (this.config.search === undefined)
			this.config.search = input.inferAccessor();
		if (this.config.hash === undefined)
			this.config.hash = input.handlers.hash;
		if (typeof this.config.hash != "function")
			this.config.hash = _ => null;
		
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

	async search(query = null, refresh = false) {
		if (typeof query == "boolean") {
			refresh = query;
			query = null;
		}

		if (typeof query != "string")
			query = this.parent ? this.parent.state.query : "";

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
			useSearchFetch = typeof this.config.searchFetch == "function",
			useDynamicCache = useSearchFetch,
			useFunctionalSearch = typeof this.config.search == "function",
			performSearch = Boolean(useFunctionalSearch && !useSearchFetch),
			cached = this.config.cache === false || refresh ?
				null :
				useDynamicCache ? this.cache.dynamic[query] : this.cache.static;

		let options = this.config.options,
			hashedOptions = null,
			length = 0;

		if (cached) {
			options = cached.options;
			hashedOptions = cached.hashedOptions
			length = cached.length;

			if (useDynamicCache && this.state.lastQuery != null && query != this.state.lastQuery)
				this.collapseOptions(options);
		} else if (useSearchFetch)
			options = await this.config.searchFetch(runtime);
		else if (typeof options == "function") {
			options = await options(runtime);
			this.state.fetches++;
		}

		if (!Array.isArray(options)) {
			this.state.error = true;

			if (typeof options == "string")
				this.state.errorMsg = options;
			
			this.callHooks("error", this.state);
			return null;
		}

		runtime.options = options;

		if (!cached) {
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
					option.context = new OptionsContext(this.input, option, this.globalConfig, this);
					if (option.context.config.expanded)
						option.context.search();
				} else {
					option.type = "leaf";
					option.context = this;
				}

				option.visible = true;
				option.hash = this.config.hash(option.value);

				if (option.hash)
					hashed[option.hash] = option;
				processedOptions.push(option);

				if (option.type == "leaf") {
					option.selected = this.hasSelectedOption(option);
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

		if (performSearch) {
			length = 0;

			for (let i = 0, l = options.length; i < l; i++) {
				const option = options[i];

				if (useFunctionalSearch) {
					runtime.option = option.value;
					option.visible = Boolean(this.config.search(runtime));
				} else if (typeof this.config.search == "string") {
					const testVal = get(option.value, this.config.search);

					if (!isPrimitive(testVal))
						console.warn("Search value is not primitive", testVal);

					option.visible = queryRegex.test(String(testVal));
				}

				if (option.visible)
					length++;
			}
		}

		this.options = options;
		this.hashedOptions = hashedOptions;
		this.length = length;

		if (this.config.cache !== false) {
			if (useDynamicCache) {
				this.cache.dynamic[query] = {
					options,
					hashedOptions,
					length
				};
			} else {
				this.cache.static = {
					options,
					hashedOptions,
					length
				};
			}
		}

		this.state.lastQuery = query;
		this.state.loading = false;
		this.state.fetches++;
		this.callHooks("fetched", this.state);
		return options;
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
				options: this.root.options
			}),
			...args
		);
	}

	compareOptions(option, option2) {
		if (option == option2)
			return true;

		if (option.hash != null)
			return option.hash == option2.hash;

		return this.input.compare(option, option2);
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

	getSelection() {
		const root = this.root,
			selection = [];

		for (let i = 0, l = root.selection.length; i < l; i++)
			selection.push(root.selection[i].value);

		return selection;
	}
}

function isOptionConfig(candidate) {
	return matchQuery(candidate, OPTION_CONFIG_SCHEMA, "typed|lazy");
}

function isContextConfig(candidate) {
	if (candidate.nest === false)
		return false;

	return matchQuery(candidate, BASE_CONFIG_SCHEMA, "typed|lazy");
}
