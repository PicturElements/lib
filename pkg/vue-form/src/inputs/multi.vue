<template lang="pug">
	.input-wrapper.multi.inp-multi(:class="[ expanded ? 'open' : null, isMobile() ? 'mobi' : null, validationState, dropdownDirection ]")
		textarea.focus-probe(
			@focus="expand"
			@blur="enqueueCollapse"
			ref="focusProbe")
		.collapse-target(@click="collapse")
		.selection-box(
			@mousedown="triggerExpand"
			@touchstart="triggerExpand"
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
		.search-box(:style="searchBoxStyle"
			@mousedown="triggerExpand"
			@touchstart="triggerExpand"
			ref="searchBox")
			.search-input-box
				input.search-input(
					v-model="query"
					@input="triggerSearch"
					@focus="expand"
					@blur="enqueueCollapse"
					tabindex="-1"
					ref="searchInput")
			.search-results-box(ref="searchResultsBox")
				template(v-if="!options.length")
					slot(name="no-search-results" v-bind="this")
						.no-search-results No results found
				template(v-else-if="$scopedSlots['search-result']")
					template(v-for="(option, idx) in options")
						slot(
							name="search-result"
							v-bind="{ index: idx, option, data: option, optionPtr, select: _ => triggerAddToSelection(option) }")
				.default-search-result(
					v-else
					v-for="(option, idx) in options"
					:class="optionPtr == idx ? 'selected' : null"
					@click="triggerAddToSelection(option, idx)"
					ref="defaultSearchResults")
					span.search-result.value
						slot(
							name="search-result-value"
							v-bind="{ index: idx, option, data: option, optionPtr, select: _ => triggerAddToSelection(option) }") {{ getLabel(option) }}
			.loading-overlay(v-if="loading")
				slot(name="loading-icon")
</template>

<script>
	import Form, { Multi } from "@qtxr/form";
	import EVT from "@qtxr/evt";
	import {
		cleanRegex,
		requestFrame,
		isPrimitive
	} from "@qtxr/utils";
	
	const PADDING = 30,
		BOTTOM_BIAS = 0.5;

	export default {
		name: "Multi",
		data: _ => ({
			expanded: false,
			expansionRequested: false,
			dropdownDirection: null,
			searchBoxStyle: null,
			updateLoopInitialized: false,
			loading: false,
			query: "",
			options: [],
			optionPtr: -1,
			lastOptionPtr: -1,
			globalClickListener: null,
			globalKeyListener: null,
			validationMsg: null,
			validationState: "ok"
		}),
		methods: {
			triggerSearch() {
				this.lastOptionPtr = -1;
				this.search();
			},
			async search() {
				this.optionPtr = -1;
				this.loading = true;

				let options = await this.res(this.input.options);

				if (!Array.isArray(options))
					options = [];

				const val = this.input.value,
					outOptions = [],
					maxSearchResults = this.input.maxSearchResults || Infinity;
				let searchedOptions = [];

				if (!this.input.noSearch) {
					const query = this.query,
						queryRegex = new RegExp(cleanRegex(this.query), "i"),
						searchArgs = {
							options,
							query,
							queryRegex
						};
						
					for (let i = 0, l = options.length; i < l; i++) {
						if (typeof this.input.search == "function") {
							const match = this.input.search(options[i], searchArgs);

							if (match)
								searchedOptions.push(label);
						} else {
							const label = this.getLabel(options[i]);

							if (!isPrimitive(label))
								throw new Error(`Search value is not primitive`);

							if (queryRegex.test(String(label)))
								searchedOptions.push(options[i]);
						}
					}
				} else
					searchedOptions = options;

				for (let i = 0, l = searchedOptions.length; i < l; i++) {
					const option = searchedOptions[i];
					let matched = false;

					for (let j = 0, l2 = val.length; j < l2; j++) {
						if (this.input.compare(option, val[j])) {
							matched = true;
							break;
						}
					}

					if (!matched) {
						outOptions.push(option);

						if (outOptions.length == maxSearchResults)
							break;
					}
				}

				this.loading = false;
				this.options = outOptions;
			},
			deleteSelectionItem(idx) {
				const val = this.input.value,
					valOut = [];

				for (let i = 0, l = val.length; i < l; i++) {
					if (i != idx)
						valOut.push(val[i]);
				}

				this.trigger(valOut);
				this.search();
			},
			triggerAddToSelection(option, idx) {
				this.lastOptionPtr = idx;
				this.$refs.searchInput.focus();
				this.addToSelection(option);
			},
			addToSelection(option) {
				const val = this.input.value,
					valOut = [];

				for (let i = 0, l = val.length; i < l; i++)
					valOut.push(val[i]);

				valOut.push(option);
				requestFrame(_ => this.$refs.selectionBox.scrollTop = 10000);
				this.trigger(valOut);
				this.search();
			},
			trigger(val) {
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

				this.searchBoxStyle = {
					position: "fixed",
					top: placeBottom ? `${bcr.top + bcr.height - bBottom}px` : null,
					bottom: placeBottom ? null : `${window.innerHeight - bcr.top - bTop}px`,
					borderTop: placeBottom ? "none" : null,
					borderBottom: placeBottom ? null : "none",
					left: `${bcr.left}px`,
					width: `${bcr.width - bLeft - bRight}px`,
					maxHeight: `${maxHeight}px`
				};
			
				this.dropdownDirection = placeBottom ? "place-bottom" : "place-top",

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
				if (!this.options.length || this.optionPtr == -1)
					return;

				this.lastOptionPtr = this.optionPtr;
				this.addToSelection(this.options[this.optionPtr]);
			},
			focusOption() {
				if (!this.$refs.defaultSearchResults)
					return;

				const searchResultsBox = this.$refs.searchResultsBox,
					obcr = this.$refs.defaultSearchResults[this.optionPtr].getBoundingClientRect(),
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
				this.expanded = true;
				this.search();
				this.initUpdateLoop();
				requestFrame(_ => this.$refs.searchInput.focus());
			},
			collapse(evt) {
				if (this.expansionRequested)
					return;

				this.expanded = false;
				this.dropdownDirection = null;
			},
			res(val, ...args) {
				if (typeof val == "function")
					return val.call(this, this.input, ...args);

				return val;
			},
			isMobile() {
				const mobileQuery = this.mobileQuery || this.meta.mobileQuery || "(max-aspect-ratio: 1/1) and (max-width: 700px)";
				return matchMedia(mobileQuery).matches;
			}
		},
		props: {
			input: Multi,
			mobileQuery: String,
			meta: {
				type: Object,
				default: _ => ({})
			}
		},
		beforeMount() {
			this.input.hook("update", inp => {
				this.validationState = inp.validationState;
				this.validationMsg = inp.validationMsg || this.validationMsg;
			});

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
