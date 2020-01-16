<template lang="pug">
	.input-wrapper.multi.inp-multi(:class="[ expanded ? 'open' : null, input.noSearch ? 'no-search' : null, isMobile() ? 'mobi' : null, validationState, dropdownDirection ]")
		textarea.focus-probe(
			:disabled="disabled"
			@focus="expand"
			@blur="enqueueCollapse"
			ref="focusProbe")
		.collapse-target(@click="collapse")
		.selection-box(
			@mousedown="triggerExpand"
			@click="triggerExpand"
			ref="selectionBox")
			template(v-if="$scopedSlots['selection-item']")
				template(v-for="(item, idx) in input.value")
					slot(
						name="selection-item"
						v-bind="{ index: idx, item, data: item, delete: _ => deleteSelectionItem(idx) }")
			.default-selection-item(
				v-else
				v-for="(item, idx) in input.value")
				span.selection-item.value
					slot(
						name="selection-item-value"
						v-bind="{ index: idx, item, data: item, delete: _ => deleteSelectionItem(idx) }") {{ getLabel(item) }}
				.delete-section-item(@click="deleteSelectionItem(idx)") &times;
		.search-box(
			:style="searchBoxStyle"
			@mousedown="triggerExpand"
			@touchstart="triggerExpand"
			ref="searchBox")
			.search-input-box(v-if="!input.noSearch")
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
			.search-results-wrapper
				.search-results-box(ref="searchResultsBox")
					template(v-if="!options.length")
						slot(name="no-search-results" v-bind="this")
							.no-search-results No results found
					.search-result(
						v-else-if="$scopedSlots['search-result']"
						v-for="(option, idx) in options"
						:class="optionPtr == idx ? 'selected' : null"
						@mousemove="setOptionPtr(idx)")
						slot(
							name="search-result"
							v-bind="{ index: idx, option, data: option, optionPtr, select: _ => triggerAddToSelection(option, idx) }")
					.search-result.default-search-result(
						v-else
						v-for="(option, idx) in options"
						:class="optionPtr == idx ? 'selected' : null"
						@click="triggerAddToSelection(option, idx)"
						@mousemove="setOptionPtr(idx)"
						ref="searchResult")
						span.search-result-value
							slot(
								name="search-result-value"
								v-bind="{ index: idx, option, data: option, optionPtr, select: _ => triggerAddToSelection(option, idx) }") {{ getLabel(option) }}
				.loading-overlay(v-if="loading")
					slot(name="loading-icon" v-bind="this")
</template>

<script>
	import { Multi } from "@qtxr/form";
	import EVT from "@qtxr/evt";
	import {
		get,
		equals,
		cleanRegex,
		isPrimitive,
		requestFrame
	} from "@qtxr/utils";
	import mixin from "../mixin";
	
	const PADDING = 30,
		BOTTOM_BIAS = 0.5;

	export default {
		name: "Multi",
		mixins: [mixin],
		data: _ => ({
			expanded: false,
			expansionRequested: false,
			dropdownDirection: null,
			searchBoxStyle: null,
			updateLoopInitialized: false,
			loading: false,
			deferTimeout: null,
			searchDisabled: false,
			query: "",
			lastQuery: null,
			allOptions: null,
			searchedOptions: [],
			options: [],
			optionPtr: -1,
			lastOptionPtr: -1,
			globalKeyListener: null
		}),
		methods: {
			async search(refresh = false) {
				if (!refresh && this.query == this.lastQuery)
					return;

				this.searchDisabled = true;
				this.loading = true;
				this.setOptionPtr(-1);

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
					searchAccessor = typeof this.input.handlers.inject == "string" ?
						this.input.handlers.inject :
						this.input.handlers.extract
						
				let options = useSearchFetch ?
					await this.res(this.input.searchFetch, searchArgs, refresh) :
					(this.allOptions && this.input.cacheOptions && !refresh ?
						this.allOptions :
						await this.res(this.input.options, refresh));

				if (!Array.isArray(options))
					options = [];

				let searchedOptions = [];

				searchArgs.options = options;
				searchArgs.fetched = true;

				if (useSearchFetch || this.input.noSearch)
					searchedOptions = options;
				else {
					for (let i = 0, l = options.length; i < l; i++) {
						if (useFunctionalSearch) {
							const match = this.res(this.input.search, options[i], searchArgs);

							if (match)
								searchedOptions.push(options[i]);
						} else {
							const testVal = get(options[i], searchAccessor);

							if (!isPrimitive(testVal))
								console.warn("Search value is not primitive", testVal);

							if (queryRegex.test(String(testVal)))
								searchedOptions.push(options[i]);
						}
					}
				}

				this.allOptions = options;
				this.searchedOptions = searchedOptions;
				this.options = this.computeDisplayedOptions(searchedOptions);
				this.loading = false;
				this.searchDisabled = false;
				this.lastQuery = this.query;
				this.$refs.searchResultsBox.scrollTop = 0;
			},
			// FIXME: quadratic time complexity
			computeDisplayedOptions(options) {
				const val = this.input.value,
					maxResults = this.input.maxSearchResults || Infinity,
					outOptions = [];

				for (let i = 0, l = options.length; i < l; i++) {
					const option = options[i];
					let matched = false;

					for (let j = 0, l2 = val.length; j < l2; j++) {
						if (this.input.compare(option, val[j])) {
							matched = true;
							break;
						}
					}

					if (!matched) {
						outOptions.push(option);

						if (outOptions.length == maxResults)
							break;
					}
				}

				return outOptions;
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
			deleteSelectionItem(idx, item) {
				const val = this.input.value,
					option = val[idx],
					valOut = [];

				for (let i = 0, l = val.length; i < l; i++) {
					if (i != idx)
						valOut.push(val[i]);
				}

				this.trigger(valOut);
				this.options = this.computeDisplayedOptions(this.searchedOptions);
			},
			triggerAddToSelection(option, idx) {
				this.lastOptionPtr = idx;
				if (!this.isMobile())
					(this.$refs.searchInput || this.$refs.focusProbe).focus();
				this.addToSelection(option, idx);
			},
			addToSelection(option, idx) {
				const val = this.input.value,
					startIdx = typeof this.input.max == "number" ?
						Math.max(val.length - this.input.max + 1, 0) :
						0,
					valOut = [];

				for (let i = startIdx, l = val.length; i < l; i++)
					valOut.push(val[i]);

				valOut.push(option);
				requestFrame(_ => this.$refs.selectionBox.scrollTop = 10000);
				this.trigger(valOut);
				this.options.splice(idx, 1);

				if (startIdx > 0)
					this.options = this.computeDisplayedOptions(this.searchedOptions);
			},
			trigger(val) {
				if (!this.disabled)
					this.input.trigger(val);
			},
			getLabel(option) {
				const label = (option && option.hasOwnProperty("label")) ? option.label : option;
				return typeof label == "object" ? "" : label;
			},
			initUpdateLoop() {
				if (!this.updateLoopInitialized) {
					this.updateLoopInitialized = true;
					this.updateFixedBox();
				}
			},
			updateFixedBox() {
				if (!this.expanded || !this.$refs.searchBox) {
					this.searchBoxStyle = null;
					this.updateLoopInitialized = false;
					return;
				}

				const style = getComputedStyle(this.$refs.searchBox),
					bcr = this.$refs.selectionBox.getBoundingClientRect(),
					borderBox = style.boxSizing == "border-box",
					sHeight = this.$refs.searchBox.scrollHeight,
					bTop = borderBox ? 0 : parseFloat(style.borderTopWidth),
					bRight = borderBox ? 0 : parseFloat(style.borderRightWidth),
					bBottom = borderBox ? 0 : parseFloat(style.borderBottomWidth),
					bLeft = borderBox ? 0 : parseFloat(style.borderLeftWidth),
					topAvailable = bcr.top - PADDING,
					bottomAvailable = window.innerHeight - (bcr.top + bcr.height) - PADDING,
					placeBottom = bottomAvailable > (topAvailable * BOTTOM_BIAS) || sHeight < bottomAvailable - 100,
					maxHeight = placeBottom ? bottomAvailable : topAvailable;

				const stl = {
					position: "fixed",
					top: placeBottom ? `${bcr.top + bcr.height - bBottom}px` : null,
					bottom: placeBottom ? null : `${window.innerHeight - bcr.top - bTop}px`,
					borderTop: placeBottom ? "none" : null,
					borderBottom: placeBottom ? null : "none",
					left: `${bcr.left}px`,
					width: `${bcr.width - bLeft - bRight}px`,
					maxHeight: `${maxHeight}px`
				};

				if (!equals(stl, this.searchBoxStyle)) {
					this.searchBoxStyle = stl;
					this.dropdownDirection = placeBottom ? "place-bottom" : "place-top";
				}

				requestFrame(_ => this.updateFixedBox());
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
				this.addToSelection(this.options[this.optionPtr], this.optionPtr);
			},
			setOptionPtr(ptr) {
				this.optionPtr = ptr;
				this.lastOptionPtr = ptr;
			},
			focusOption() {
				if (!this.$refs.searchResult)
					return;

				const searchResultsBox = this.$refs.searchResultsBox,
					obcr = this.$refs.searchResult[this.optionPtr].getBoundingClientRect(),
					sbcr = searchResultsBox.getBoundingClientRect(),
					scroll = searchResultsBox.scrollTop + (obcr.top - sbcr.top) - (sbcr.height - obcr.height) / 2;

				searchResultsBox.scrollTop = scroll;
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

				if (!this.expanded)
					this.search();

				this.expanded = true;
				this.initUpdateLoop();

				if (!this.isMobile())
					requestFrame(_ => (this.$refs.searchInput || this.$refs.focusProbe).focus());
			},
			collapse(evt) {
				if (this.expansionRequested)
					return;

				this.expanded = false;
				this.dropdownDirection = null;
				this.setOptionPtr(-1);
				if (!this.isMobile())
					this.$refs.focusProbe.blur();
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
			input: Multi
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
		},
		beforeDestroy() {
			document.body.removeEventListener("keydown", this.globalKeyListener);
		}
	};
</script>
