<template lang="pug">
	Drop.input-wrapper.multi.inp-multi(
		:class="cl({ 'no-search': res(input.noSearch) })"
		:disabled="dis"
		:flushDropdown="true"
		scrollTarget=".options"
		@expand="expand"
		@key="key"
		@assets="assets => dropAssets = assets")
		template(#expando-box="rt")
			.selection-box(
				@mousedown="triggerExpand"
				@click="triggerExpand"
				ref="selectionBox")
				template(v-if="$scopedSlots['selection-item']")
					template(v-for="(item, idx) in input.value")
						slot(
							name="selection-item"
							v-bind="bind({ index: idx, item, data: item, delete: _ => deleteSelectionItem(idx) })")
				.default-selection-item(
					v-else
					v-for="(item, idx) in input.value")
					span.selection-item.value
						slot(
							name="selection-item-value"
							v-bind="bind({ index: idx, item, data: item, delete: _ => deleteSelectionItem(idx) })") {{ getLabel(item) }}
					.delete-section-item(@click="deleteSelectionItem(idx)") &times;
		template(#content="{ focus, blur, adaptiveBlur }")
			.search-input-box(v-if="!input.noSearch")
				input.search-input(
					:class="{ 'pseudo-disabled': searchDisabled }"
					v-model="query"
					v-bind="inpProps"
					@keydown="guardInput"
					@input="triggerSearch"
					@focus="focus"
					@blur="adaptiveBlur"
					ref="searchInput")
				button.search-refresh(
					v-if="!noRefresh"
					tabindex="-1"
					:disabled="searchDisabled"
					@mousedown="focus"
					@focus="focus"
					@blur="adaptiveBlur"
					@click="search(true)")
			.search-results-wrapper
				.search-results-box(ref="searchResultsBox")
					template(v-if="!options.length")
						slot(name="no-search-results" v-bind="bnd")
							.no-search-results No results found
					.search-result(
						v-else-if="$scopedSlots['search-result']"
						v-for="(option, idx) in options"
						:class="optionPtr == idx ? 'selected' : null"
						@mousemove="setOptionPtr(idx)")
						slot(
							name="search-result"
							v-bind="bind({ index: idx, option, data: option, optionPtr, select: _ => triggerAddToSelection(option, idx) })")
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
								v-bind="bind({ index: idx, option, data: option, optionPtr, select: _ => triggerAddToSelection(option, idx) })") {{ getLabel(option) }}
				.loading-overlay(v-if="loading")
					slot(name="loading-icon" v-bind="bnd")
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

	import Drop from "../core/drop.vue";
	
	const PADDING = 30,
		BOTTOM_BIAS = 0.5;

	export default {
		name: "Multi",
		mixins: [mixin],
		data: _ => ({
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
			dropAssets: null
		}),
		methods: {
			async search(refresh = false) {
				if (this.loading || (!this.input.searchOnExpand && !refresh && this.query == this.lastQuery))
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
				if (!this.inert)
					this.input.trigger(val);
			},
			getLabel(option) {
				const label = (option && option.hasOwnProperty("label")) ? option.label : option;
				return typeof label == "object" ? "" : label;
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
			expand() {
				if (this.inert)
					return;

				if (!this.expanded)
					this.search();
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
		components: {
			Drop
		}
	};
</script>
