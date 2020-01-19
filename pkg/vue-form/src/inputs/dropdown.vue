<template lang="pug">
	.input-wrapper.dropdown.inp-dropdown(:class="[ expanded ? 'open' : null, input.noSearch ? 'no-search' : null, isMobile() ? 'mobi' : null, validationState, dropdownDirection ]"
		ref="dropdownBox")
		button.mobi-focus(
			:disabled="disabled"
			@click="expand")
		textarea.focus-probe(
			:disabled="disabled"
			@focus="expand"
			@blur="enqueueCollapse"
			@click="triggerExpand"
			ref="focusProbe")
		.collapse-target(@click="collapse")
		.dropdown-option.dropdown-active-option
			slot(name="icon" v-bind="$data")
				.dropdown-icon.default-icon(:class="{ expanded }") {{ expanded ? "-" : "+" }}
			.dropdown-option-inner
				span.placeholder(v-if="activeOption == null")
					| {{ input.placeholder || placeholder }}
				slot(v-else
					v-bind="wrapOption(activeOption && activeOption.value)")
					| {{ getLabel(activeOption && activeOption.value) }}
		.dropdown-list(
			:style="listStyle"
			ref="list")
			.search-input-box(v-if="!input.noSearch"
				@mousedown="triggerExpand"
				@touchstart="triggerExpand")
				input.search-input(
					v-model="query"
					tabindex="-1"
					:disabled="disabled"
					:class="{ 'pseudo-disabled': searchDisabled }"
					@keydown="guardInput"
					@input="triggerSearch"
					@focus="expand"
					@blur="enqueueCollapse"
					ref="searchInput")
				button.search-refresh(
					v-if="!noRefresh"
					tabindex="-1"
					:disabled="searchDisabled"
					@click="search(true)")
			.options-wrapper
				.options(
					@mousedown.stop="triggerCollapse"
					ref="options")
					template(v-if="!options.length")
						slot(name="no-search-results" v-bind="this")
							.no-search-results No results found
					.dropdown-option(
						v-else
						v-for="(option, idx) in options"
						:class="{ selected: option == activeOption, 'selected-option': idx == optionPtr }"
						@mousedown="trigger(option, idx)"
						@click="trigger(option, idx)"
						@mousemove="setOptionPtr(idx)"
						ref="option")
						.dropdown-option-inner
							slot(v-bind="wrapOption(option.value)") {{ getLabel(option.value) }}
				.loading-overlay(v-if="loading")
					slot(name="loading-icon" v-bind="this")
</template>

<script>
	import {
		get,
		equals,
		cleanRegex,
		isPrimitive,
		requestFrame
	} from "@qtxr/utils";
	import { Dropdown } from "@qtxr/form";
	import EVT from "@qtxr/evt";
	import mixin from "../mixin";
	
	const PADDING = 30,
		BOTTOM_BIAS = 0.4,
		NULL = { name: "" };

	export default {
		name: "Dropdown",
		mixins: [mixin],
		data: _ => ({
			expanded: false,
			expansionRequested: false,
			dropdownDirection: null,
			listStyle: null,
			updateLoopInitialized: false,
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
			globalKeyListener: null
		}),
		methods: {
			async search(refresh = false) {
				if (this.loading || (!this.input.searchOnExpand && !refresh && this.query == this.lastQuery)) {
					this.updateSelection();
					return;
				}

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

				if (this.input.initFetchedOptions) {
					options = await this.input.initFetchedOptions;
					this.input.initFetchedOptions = null;
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

				if (this.input.defer) {
					this.deferTimeout = setTimeout(_ => {
						this.$refs.focusProbe.focus();
						this.search();
					}, this.input.defer);
				} else
					this.search();
			},
			guardInput(evt) {
				if (!this.searchDisabled)
					return;

				switch (EVT.getKey(evt)) {
					case "escape":
					case "tab":
						break;

					default:
						evt.preventDefault();
				}
			},
			trigger(option, idx) {
				if (!this.disabled) {
					this.input.trigger(option.value);
					this.bufferedOptionPtr = idx;
					this.activeOption = option;
					this.input.selectedIndex = option.idx;
				}

				this.triggerCollapse();
			},
			getLabel(option) {
				const label = (option && option.hasOwnProperty("label")) ? option.label : option;
				return typeof label == "object" ? "" : label;
			},
			getValue(option) {
				const value = (option && option.hasOwnProperty("label")) ? option.value : option;
				return typeof value == "object" ? "" : value;
			},
			wrapOption(option) {
				if (typeof option != "object")
					return { value: option };

				return option;
			},
			initUpdateLoop() {
				if (!this.updateLoopInitialized) {
					this.updateLoopInitialized = true;
					this.updateFixedList();
				}
			},
			updateFixedList() {
				if (!this.expanded || this.isMobile() || !this.$refs.dropdownBox) {
					this.listStyle = null;
					this.updateLoopInitialized = false;
					return;
				}

				const style = getComputedStyle(this.$refs.dropdownBox),
					bcr = this.$refs.dropdownBox.getBoundingClientRect(),
					sHeight = this.$refs.list.scrollHeight,
					bTop = parseFloat(style.borderTopWidth),
					bRight = parseFloat(style.borderRightWidth),
					bBottom = parseFloat(style.borderBottomWidth),
					bLeft = parseFloat(style.borderLeftWidth),
					topAvailable = bcr.top - PADDING,
					bottomAvailable = window.innerHeight - (bcr.top + bcr.height) - PADDING,
					placeBottom = bottomAvailable > (topAvailable * BOTTOM_BIAS) || sHeight < bottomAvailable,
					maxHeight = placeBottom ? bottomAvailable : topAvailable;

				const stl = {
					position: "fixed",
					top: placeBottom ? `${bcr.top + bcr.height - bBottom}px` : null,
					bottom: placeBottom ? null : `${window.innerHeight - bcr.top - bTop}px`,
					left: `${bcr.left}px`,
					width: `${bcr.width - bLeft - bRight}px`,
					maxHeight: `${maxHeight}px`
				};

				if (!equals(stl, this.listStyle)) {
					this.listStyle = stl;
					this.dropdownDirection = placeBottom ? "place-bottom" : "place-top";
				}

				requestFrame(_ => this.updateFixedList());
			},
			incrementOptionPtr() {
				if (!this.options.length)
					return;

				if (this.optionPtr == -1 && this.lastOptionPtr > -1)
					this.optionPtr = this.lastOptionPtr - 1;

				this.optionPtr = (this.optionPtr + 1) % this.options.length;
				this.focusOption();
			},
			decrementOptionPtr() {
				if (!this.options.length)
					return;

				if (this.optionPtr == -1 && this.lastOptionPtr > -1)
					this.optionPtr = this.lastOptionPtr - 1;

				this.optionPtr = (this.options.length + this.optionPtr - 1) % this.options.length;
				this.focusOption();
			},
			selectOptionWithPtr() {
				if (!this.options.length || this.optionPtr == -1 || this.optionPtr >= this.options.length)
					return;

				this.lastOptionPtr = this.optionPtr;
				this.trigger(this.options[this.optionPtr]);
				this.collapse();
			},
			setOptionPtr(ptr) {
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
			},
			triggerExpand() {
				if (!this.isMobile() && !this.expansionRequested) {
					this.expansionRequested = true;
					setTimeout(_ => this.expansionRequested = false, 200);
				}
				
				this.expand();
			},
			triggerCollapse() {
				if (this.isMobile())
					this.collapse();
				else
					this.$refs.focusProbe.blur();
			},
			enqueueCollapse() {
				requestFrame(_ => {
					const active = document.activeElement;

					if (active != this.$refs.focusProbe && active != this.$refs.searchInput)
						this.collapse();
				});
			},
			expand() {
				if (this.disabled)
					return;

				if (!this.expanded) {
					this.search();

					if (this.bufferedOptionPtr > -1) {
						this.setOptionPtr(this.bufferedOptionPtr);
						requestFrame(_ => this.focusOption());
					}
				}

				this.expanded = true;
				this.initUpdateLoop();

				if (!this.isMobile() && this.$refs.searchInput)
					requestFrame(_ => this.$refs.searchInput.focus());
			},
			collapse(evt) {
				if (this.expansionRequested)
					return;

				this.expanded = false;
				this.dropdownDirection = null;
			}
		},
		computed: {
			noRefresh() {
				if (typeof this.input.noRefresh == "boolean")
					return this.input.noRefresh;

				return typeof this.input.searchFetch != "function" && typeof this.input.options != "function";
			}
		},
		props: {
			input: Dropdown,
			placeholder: String
		},
		watch: {
			"input.value"() {
				if (!this.activeOption || !this.input.compare(this.input.value, this.activeOption.value)) {
					this.updateSelection();
					this.search();
				}
			}
		},
		beforeMount() {
			this.globalKeyListener = evt => {
				if (!this.expanded)
					return;

				switch (EVT.getKey(evt)) {
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
					case "escape":
						this.collapse();
						break;
				}
			};
			document.body.addEventListener("keydown", this.globalKeyListener);

			if (this.input.value)
				this.search();
		},
		beforeDestroy() {
			document.body.removeEventListener("keydown", this.globalKeyListener);
		}
	};
</script>
