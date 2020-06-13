<template lang="pug">
	Drop.input-wrapper.dropdown.inp-dropdown(
		v-bind="propPassthrough"
		:class="cl({ 'no-search': res(input.noSearch) })"
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
						slot(
							v-else
							:name="getOptionSlotName(input.optionsContext)"
							v-bind="bindOption(activeOption)")
							slot(
								name="active-option"
								v-bind="bindOption(activeOption)")
								slot(v-bind="bindOption(activeOption)")
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
					:class="{ go: input.noAutoSearch && query !== input.optionsContext.state.lastQuery }"
					:disabled="searchDisabled"
					@click="search(true)"
					tabindex="-1")
			Options(
				:input="input"
				:context="input.optionsContext"
				:active="expanded"
				:updates="searches"
				@trigger="trigger"
				@pointermove="blurSearch")
				template(
					v-for="(_, name) in $scopedSlots"
					#[name]="d")
					slot(
						:name="name"
						v-bind="d")
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
			query: "",
			expanded: false,
			dropAssets: null,
			deferTimeout: null,
			searches: 0
		}),
		methods: {
			expand() {
				this.expanded = true;
				this.search();
			},
			collapse() {
				this.expanded = false;
			},
			blurSearch() {
				const inp = this.$refs.searchInput;
				if (inp) {
					inp.blur();
					this.dropAssets.focus();
				}
			},
			search(refresh = false) {
				this.searches++;
				this.input.optionsContext.search(this.query, refresh);
			},
			trigger(option) {
				if (!this.inert)
					this.input.trigger(option.value);

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
		},
		computed: {
			noRefresh() {
				if (typeof this.input.noRefresh == "boolean")
					return this.input.noRefresh;

				return typeof this.input.searchFetch != "function" && typeof this.input.options != "function";
			},
			activeOption() {
				const sel = this.input.optionsContext.selection;
				if (!sel.length)
					return null;

				return sel[0];
			},
			searchDisabled() {
				return this.input.optionsContext.state.loading;
			}
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
		}
	};
</script>
