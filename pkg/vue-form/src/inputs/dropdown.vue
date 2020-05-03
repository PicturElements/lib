<template lang="pug">
	Drop.input-wrapper.dropdown.inp-dropdown(
		:class="cl({ 'no-search': res(input.noSearch) })"
		:disabled="dis"
		:adaptive="true"
		:flushDropdown="true"
		:flushWidth="res(flushWidth)"
		:gap="res(gap)"
		scrollTarget=".options-scroller"
		@expand="expand"
		@collapse="collapse"
		@assets="assets => dropAssets = assets")
		template(#expando-box="rt")
			.options-wrapper
				.option.active-option.with-icon
					.option-inner
						span.placeholder(v-if="activeOption == null")
							| {{ res(input.placeholder || placeholder) }}
						slot(v-else
							name="active-option"
							v-bind="bindOption(activeOption, true)")
							slot(
								:name="getOptionSlotName(input.optionsContext)"
								v-bind="bindOption(activeOption, true)")
								slot(v-bind="bindOption(activeOption, true)")
									| {{ getLabel(activeOption) }}
					slot(name="icon" v-bind="bnd")
						.dropdown-icon.default-icon.chevron(:class="{ flip: expanded }")
		template(#content)
			.search-input-box(v-if="!input.noSearch")
				input.search-input(
					:class="{ 'pseudo-disabled': searchDisabled }"
					v-model="query"
					v-bind="inpProps"
					@keydown="guardInput"
					@input="triggerSearch"
					ref="searchInput")
				button.search-refresh(
					v-if="!noRefresh"
					:class="{ go: input.noAutoSearch && query !== lastQuery }"
					:disabled="searchDisabled"
					@click="search(true)"
					tabindex="-1"
					ref="searchRefresh")
			Options(
				:input="input"
				:context="input.optionsContext"
				@trigger="trigger")
				template(
					v-for="(_, name) in $scopedSlots"
					#[name]="d")
					slot(
						:name="name"
						v-bind="d")
				//- .options(ref="options")
					template(v-if="!options.length")
						slot(name="no-search-results" v-bind="bnd")
							.no-search-results No results found
					.dropdown-option(
						v-else
						v-for="(option, idx) in options"
						:class="{ selected: option == activeOption, 'selected-option': idx == optionPtr }"
						@mousedown="focus"
						@click="trigger(option, idx)"
						@mousemove="setOptionPtr(idx)"
						ref="option")
						.dropdown-option-inner
							slot(v-bind="bindOption(option.value)") {{ getLabel(option.value) }}
				//- .loading-overlay(v-if="loading")
					slot(name="loading-icon" v-bind="bnd")
</template>

<script>
	import {
		get,
		cleanRegex,
		isPrimitive,
		requestFrame
	} from "@qtxr/utils";
	import { Dropdown } from "@qtxr/form";
	import EVT from "@qtxr/evt";
	import mixin from "../mixin";

	import Drop from "../core/drop.vue";
	import Options from "../core/options.vue";

	export default {
		name: "Dropdown",
		mixins: [mixin],
		data: _ => ({
			loading: false,
			deferTimeout: null,
			searchDisabled: false,
			query: "",
			lastQuery: null,
			allOptions: null,
			options: [],
			activeOption: null,
			optionPtr: -1,
			lastOptionPtr: -1,
			bufferedOptionPtr: -1,
			expanded: false,
			dropAssets: null
		}),
		methods: {
			expand() {
				this.expanded = true;
				this.search();
			},
			collapse() {
				this.expanded = false;
			},
			search(refresh = false) {
				this.input.optionsContext.search(this.query, refresh);
			},
			trigger(option) {
				if (!this.inert) {
					this.input.trigger(option.value);
					this.activeOption = option;
				}

				this.dropAssets.collapse(2);
			},
			triggerSearch() {
				clearTimeout(this.deferTimeout);

				if (this.input.noAutoSearch)
					return;

				if (this.input.defer)
					this.deferTimeout = setTimeout(_ => this.search(), this.input.defer);
				else
					this.search();
			},
			guardInput(evt) {
				if (this.searchDisabled) {
					switch (EVT.getKey(evt)) {
						case "escape":
						case "tab":
							break;

						default:
							evt.preventDefault();
					}
				} else {
					switch (EVT.getKey(evt)) {
						case "enter":
							if (!this.noRefresh)
								this.search(true);
							break;
					}
				}
			},
			getLabel(option) {
				option = option.value;
				const label = (option && option.hasOwnProperty("label")) ?
					option.label :
					option;

				return typeof label == "object" ? "" : label;
			},
			getValue(option) {
				option = option.value;
				const value = (option && option.hasOwnProperty("value")) ?
					option.value :
					option;

				return typeof value == "object" ? "" : value;
			},
			bindOption(option) {
				return this.bind({
					fullOption: option,
					option: option.value,
					selected: option.selected
				});
			},
			getOptionSlotName(context) {
				return `${context.config.name}-option`;
			}
			/*async search(refresh = false) {
				if (this.loading || (!this.input.searchOnExpand && !refresh && this.query == this.lastQuery)) {
					this.updateSelection();
					return;
				}

				console.log("searchin'");

				this.searchDisabled = true;
				this.loading = true;
				this.setOptionPtr(-1);
				this.bufferedOptionPtr = -1;

				const query = this.query,
					searchRegexFlags = typeof this.input.searchRegexFlags == "string" ?
						this.input.searchRegexFlags :
						"i",
					queryRegex = new RegExp(cleanRegex(this.query), searchRegexFlags),
					searchArgs = {
						options: this.input.options,
						query,
						queryRegex,
						fetched: false
					},
					useSearchFetch = typeof this.input.searchFetch == "function",
					useFunctionalSearch = typeof this.input.search == "function",
					useCachedOptions = this.allOptions && this.input.cacheOptions && !refresh,
					performSearch = !useSearchFetch && !this.input.noSearch && (!useFunctionalSearch && query),
					searchAccessor = typeof this.input.handlers.inject == "string" ?
						this.input.handlers.inject :
						this.input.handlers.extract;

				let options;

				if (this.input.pendingOptions) {
					options = await this.input.pendingOptions;
					console.log("loooool", this.input, options);
				} else {
					options = useSearchFetch ?
						await this.res(this.input.searchFetch, searchArgs, refresh) :
						(useCachedOptions ?
							this.allOptions :
							await this.res(this.input.options, refresh));
				}

				if (!Array.isArray(options))
					options = [];

				searchArgs.options = options;
				searchArgs.fetched = true;

				const searchedOptions = [],
					allOptions = [];

				this.allOptions = allOptions;
				this.activeOption = null;
				this.input.selectedIndex = -1;
				let visibleIdx = 0;

				for (let i = 0, l = options.length; i < l; i++) {
					const opt = useCachedOptions ?
						options[i] :
						{
							idx: i,
							value: options[i]
						};
					let matched = false;

					allOptions.push(opt);

					if (performSearch) {
						if (useFunctionalSearch) {
							const match = this.res(this.input.search, opt.value, searchArgs);

							if (match) {
								searchedOptions.push(opt);
								matched = true;
							}
						} else {
							const testVal = get(opt.value, searchAccessor);

							if (!isPrimitive(testVal))
								console.warn("Search value is not primitive", testVal);

							if (queryRegex.test(String(testVal))) {
								searchedOptions.push(opt);
								matched = true;
							}
						}
					}

					if (this.input.compare(this.input.value, opt.value)) {
						this.activeOption = opt;

						if (performSearch) {
							if (matched)
								this.bufferedOptionPtr = visibleIdx;
						} else
							this.bufferedOptionPtr = i;

						this.input.selectedIndex = i;
					}

					if (matched)
						visibleIdx++;
				}

				options = performSearch ? searchedOptions : allOptions;
				this.options = options;
				this.loading = false;
				this.searchDisabled = false;
				this.lastQuery = this.query;
				this.$refs.options.scrollTop = 0;
			},
			updateSelection() {
				if (this.input.compare(this.input.value, this.activeOption))
					return;

				for (let i = 0, l = this.options.length; i < l; i++) {
					if (this.input.compare(this.input.value, this.options[i].value)) {
						this.activeOption = this.options[i];
						this.bufferedOptionPtr = i;
						this.input.selectedIndex = this.options[i].idx;
						return;
					}
				}

				this.activeOption = null;
				this.input.selectedIndex = -1;
				this.bufferedOptionPtr = -1;
			},
			triggerSearch() {
				this.lastOptionPtr = -1;
				clearTimeout(this.deferTimeout);

				if (this.input.noAutoSearch)
					return;

				if (this.input.defer)
					this.deferTimeout = setTimeout(_ => this.search(), this.input.defer);
				else
					this.search();
			},
			guardInput(evt) {
				if (this.searchDisabled) {
					switch (EVT.getKey(evt)) {
						case "escape":
						case "tab":
							break;

						default:
							evt.preventDefault();
					}
				} else {
					switch (EVT.getKey(evt)) {
						case "enter":
							if (!this.noRefresh)
								this.search(true);
							break;
					}
				}
			},
			trigger(option, idx) {
				if (!this.inert) {
					this.input.trigger(option.value);
					this.bufferedOptionPtr = idx;
					this.activeOption = option;
					this.input.selectedIndex = option.idx;
				}

				this.dropAssets.blur(2);
			},
			incrementOptionPtr() {
				if (!this.options.length)
					return;

				if (this.optionPtr == -1 && this.lastOptionPtr > -1)
					this.optionPtr = this.lastOptionPtr - 1;

				this.optionPtr = (this.optionPtr + 1) % this.options.length;

				if (!this.noRefresh)
					this.focusOption();
			},
			decrementOptionPtr() {
				if (!this.options.length)
					return;

				if (this.optionPtr == -1 && this.lastOptionPtr > -1)
					this.optionPtr = this.lastOptionPtr - 1;

				this.optionPtr = (this.options.length + this.optionPtr - 1) % this.options.length;

				if (!this.noRefresh)
					this.focusOption();
			},
			selectOptionWithPtr() {
				if (!this.options.length || this.optionPtr == -1 || this.optionPtr >= this.options.length)
					return;

				this.lastOptionPtr = this.optionPtr;
				this.trigger(this.options[this.optionPtr]);
			},
			setOptionPtr(ptr) {
				if (!this.noRefresh && ptr != -1 && ptr != this.optionPtr)
					this.blurSearch();

				this.optionPtr = ptr;
				this.lastOptionPtr = ptr;
			},
			focusOption() {
				if (!this.$refs.options || this.optionPtr < 0)
					return;

				const options = this.$refs.options,
					obcr = this.$refs.option[this.optionPtr].getBoundingClientRect(),
					sbcr = options.getBoundingClientRect(),
					scroll = options.scrollTop + (obcr.top - sbcr.top) - (sbcr.height - obcr.height) / 2;

				options.scrollTop = scroll;
				this.blurSearch();
			},
			blurSearch() {
				const searchInput = this.$refs.searchInput,
					searchRefresh = this.$refs.searchRefresh;

				if (searchInput)
					searchInput.blur();
				if (searchRefresh)
					searchRefresh.blur();
	
				this.dropAssets.focus();
			},
			expand() {
				this.search();

				if (this.bufferedOptionPtr > -1) {
					this.setOptionPtr(this.bufferedOptionPtr);
					requestFrame(_ => this.focusOption());
				}
			},
			key(evt, key) {
				switch (key) {
					case "up":
						this.decrementOptionPtr();
						evt.preventDefault();
						break;

					case "down":
						this.incrementOptionPtr();
						evt.preventDefault();
						break;

					case "enter":
						this.selectOptionWithPtr();
						break;
				}
			}*/
		},
		computed: {
			noRefresh() {
				if (typeof this.input.noRefresh == "boolean")
					return this.input.noRefresh;

				return typeof this.input.searchFetch != "function" && typeof this.input.options != "function";
			}
		},
		watch: {
			"input.value"() {
				const activeOption = this.input.optionsContext.selection[0];
				if (activeOption)
					this.activeOption = activeOption;
			}
			/*"input.value"(newValue, oldValue) {
				if (!this.activeOption || !this.input.compare(this.input.value, this.activeOption.value)) {
					this.updateSelection();
					this.search();
				} else
					this.updateSelection();
			}*/
		},
		props: {
			input: Dropdown,
			flushWidth: [Boolean, Function],
			placeholder: [String, Function],
			gap: [Number, Function]
		},
		components: {
			Drop,
			Options
		},
		mounted() {
			const activeOption = this.input.optionsContext.selection[0];
			if (activeOption)
				this.activeOption = activeOption;
		}
	};
</script>
