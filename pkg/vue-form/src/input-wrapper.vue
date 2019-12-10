<template lang="pug">
	Checkbox(
		v-if="is('checkbox')"
		:input="cl.input"
		:label="res(cl.label)"
		:meta="meta")
		template(#icon="inp")
			slot(:name="`${cl.input.name}-icon`" v-bind="inp")
				slot(name="checkbox-icon" v-bind="inp")
	
	Count(
		v-else-if="is('count')"
		:input="cl.input"
		:symbols="res(cl.symbols)"
		:meta="meta")
		template(#down-symbol="inp")
			slot(:name="`${cl.input.name}-down-symbol`" v-bind="inp")
				slot(name="count-down-symbol" v-bind="inp")
		template(#up-symbol="inp")
			slot(:name="`${cl.input.name}-up-symbol`" v-bind="inp")
				slot(name="count-up-symbol" v-bind="inp")
	
	Dropdown(
		v-else-if="is('dropdown')"
		:input="cl.input"
		:placeholder="res(cl.placeholder)"
		:meta="meta")
		template(v-slot="option")
			slot(:name="`${cl.input.name}-option`" v-bind="option")
				slot(name="dropdown-option" v-bind="option")
		template(#icon="data")
			slot(:name="`${cl.input.name}-icon`" v-bind="data")
				slot(name="dropdown-icon" v-bind="data")

	Formatted(
		v-else-if="is('formatted')"
		:input="cl.input"
		:meta="meta")

	Media(
		v-else-if="is('media')"
		:input="cl.input"
		:meta="meta")
		template(#upload-icon)
			slot(:name="`${cl.input.name}-upload-icon`")
				slot(name="upload-icon")
		template(#upload-icon-fill)
			slot(:name="`${cl.input.name}-upload-icon-fill`")
				slot(name="upload-icon-fill")
		template(#upload-icon-outline)
			slot(:name="`${cl.input.name}-upload-icon-outline`")
				slot(name="upload-icon-outline")
		template(#upload-icon-ripple)
			slot(:name="`${cl.input.name}-upload-icon-ripple`")
				slot(name="upload-icon-ripple")
		template(#loading-icon)
			slot(:name="`${cl.input.name}-loading-icon`")
				slot(name="loading-icon")
		template(#upload-message)
			slot(:name="`${cl.input.name}-upload-message`")
				slot(name="upload-message")
		template(#error-message)
			slot(:name="`${cl.input.name}-error-message`")
				slot(name="error-message")

	Multi(
		v-else-if="is('multi')"
		:input="cl.input"
		:meta="meta")
		template(
			v-if="$scopedSlots['selection-item'] || $scopedSlots[`${cl.input.name}-selection-item`]"
			#selection-item="d")
			slot(:name="`${cl.input.name}-selection-item`" v-bind="d")
				slot(name="selection-item" v-bind="d")
		template(#selection-item-value="d")
			slot(:name="`${cl.input.name}-selection-item-value`" v-bind="d")
				slot(:name="`${cl.input.name}-item-value`" v-bind="d")
					slot(name="selection-item-value" v-bind="d")
						slot(name="multi-item-value" v-bind="d")
		template(
			v-if="$scopedSlots['search-result'] || $scopedSlots[`${cl.input.name}-search-result`]"
			#search-result="d")
			slot(:name="`${cl.input.name}-search-result`" v-bind="d")
				slot(name="search-result" v-bind="d")
		template(#search-result-value="d")
			slot(:name="`${cl.input.name}-search-result-value`" v-bind="d")
				slot(:name="`${cl.input.name}-item-value`" v-bind="d")
					slot(name="search-result-value" v-bind="d")
						slot(name="multi-item-value" v-bind="d")
		template(#no-search-results="inp")
			slot(:name="`${cl.input.name}-no-search-results`")
				slot(name="no-search-results")
		template(#loading-icon)
			slot(:name="`${cl.input.name}-loading-icon`")
				slot(name="loading-icon")
	
	Radio(
		v-else-if="is('radio')"
		:input="cl.input"
		:meta="meta")
		template(#label="option")
			slot(:name="`${cl.input.name}-label`" v-bind="option")
				slot(name="radio-label" v-bind="option")
		template(#custom-content="option")
			slot(:name="`${cl.input.name}-custom-content`" v-bind="option")
				slot(name="radio-custom-content" v-bind="option")

	TextArea(
		v-else-if="is('textarea')"
		:input="cl.input"
		:placeholder="res(cl.placeholder)"
		:meta="meta")
	
	Time(
		v-else-if="is('time')"
		:input="cl.input"
		:meta="meta")

	Input(
		v-else-if="is(null)"
		:input="cl.input"
		:placeholder="res(cl.placeholder)"
		:meta="meta")
</template>

<script>
	import Form from "@qtxr/form";
	
	import Input from "./inputs/input.vue";
	import Checkbox from "./inputs/checkbox.vue";
	import Count from "./inputs/count.vue";
	import Dropdown from "./inputs/dropdown.vue";
	import Formatted from "./inputs/formatted.vue";
	import Media from "./inputs/media.vue";
	import Multi from "./inputs/multi.vue";
	import Radio from "./inputs/radio.vue";
	import TextArea from "./inputs/textarea.vue";
	import Time from "./inputs/time.vue";

	export default {
		name: "VForm",
		data() {
			if (this.cell && this.cell.isInputCell) {
				return {
					cl: this.cell
				};
			} else {
				return {
					cl: {
						input: this.input || this.cell
					}
				};
			}
		},
		computed: {},
		methods: {
			is(name) {
				const inp = this.cl.input;
				if (!inp || (name !== null && inp.type != name))
					return false;

				return this.verifiedVisibility || inp.visible;
			},
			res(val, ...args) {
				if (typeof val == "function")
					return val.call(this, this.form, ...args);

				return val;
			}
		},
		components: {
			Input,
			Checkbox,
			Count,
			Dropdown,
			Formatted,
			Media,
			Multi,
			Radio,
			TextArea,
			Time
		},
		props: {
			input: null,	// Input instance
			cell: Object,
			meta: Object,
			verifiedVisibility: Boolean
		}
	};
</script>
