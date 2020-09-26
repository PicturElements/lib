<template lang="pug">
	Drop.input-wrapper.multi.inp-multi(
		v-bind="propPassthrough"
		:class="cl({ 'no-search': res(input.noSearch) })"
		:adaptive="true"
		:flushDropdown="true"
		:flushWidth="res(flushWidth)"
		:gap="res(gap)"
		:aria-invalid="err"
		scrollTarget=".options-scroller"
		@expand="expand"
		@collapse="collapse"
		@assets="assets => dropAssets = assets")
		template(#expando-box="rt")
			ul.selection-box
				template(v-if="$scopedSlots['selection-option']")
					template(v-for="(option, idx) in input.optionsContext.selection")
						slot(
							name="selection-option"
							v-bind="bindOption(option)")
				li.default-selection-option(
					v-else
					v-for="(option, idx) in input.optionsContext.selection")
					.selection-option.value
						slot(
							name="selection-option-value"
							v-bind="bindOption(option)")
							slot(
								:name="getOptionSlotName(option.context)"
								v-bind="bindOption(option)")
								slot(v-bind="bindOption(option)") {{ getLabel(option) }}
					.delete-selection-option(@click="deselect(option)") &times;
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
					tabindex="-1"
					type="button")
			Options(
				:input="input"
				:context="input.optionsContext"
				:behavior="{ toggleOption: true }"
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
	import { Multi } from "@qtxr/form";
	import EVT from "@qtxr/evt";
	import mixin from "../mixin";

	import Drop from "../core/drop.vue";
	import Options from "../core/options.vue";

	export default {
		name: "Multi",
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
			deselect(option) {
				option.deselect();
				this.trigger();
			},
			trigger() {
				if (!this.inert)
					this.input.trigger(this.input.optionsContext.selection);
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
			searchDisabled() {
				return this.input.optionsContext.state.loading;
			}
		},
		props: {
			input: Multi,
			flushWidth: [Boolean, Function],
			gap: [Number, Function]
		},
		components: {
			Drop,
			Options
		}
	};
</script>
