<template lang="pug">
	Checkbox(
		v-if="is('checkbox')"
		v-bind="props"
		:label="c.label")
		template(#icon="d")
			slot(:name="`${name}-icon`" v-bind="d")
				slot(name="checkbox-icon" v-bind="d")

	Coordinates(
		v-else-if="is('coordinates')"
		v-bind="props"
		:placeholder="c.placeholder")
		template(#geolocation-icon="d")
			slot(:name="`${name}-geolocation-icon`" v-bind="d")
				slot(name="geolocation-icon" v-bind="d")
		template(#search-icon="d")
			slot(:name="`${name}-search-icon`" v-bind="d")
				slot(name="search-icon" v-bind="d")
		template(#loading-icon="d")
			slot(:name="`${name}-loading-icon`" v-bind="d")
				slot(name="loading-icon" v-bind="d")

	Count(
		v-else-if="is('count')"
		v-bind="props"
		:symbols="c.symbols"
		:compact="c.compact")
		template(#down-symbol="d")
			slot(:name="`${name}-down-symbol`" v-bind="d")
				slot(name="count-down-symbol" v-bind="d")
		template(#up-symbol="d")
			slot(:name="`${name}-up-symbol`" v-bind="d")
				slot(name="count-up-symbol" v-bind="d")

	Date(
		v-else-if="is('date')"
		v-bind="props"
		:eagerCollapse="c.eagerCollapse")

	DateTime(
		v-else-if="is('date-time')"
		v-bind="props")

	Dropdown(
		v-else-if="is('dropdown')"
		v-bind="props"
		:placeholder="c.placeholder"
		:gap="c.gap"
		:flushWidth="c.flushWidth")
		template(v-slot="d")
			slot(:name="`${name}-option`" v-bind="d")
				slot(name="dropdown-option" v-bind="d")
		template(#active-option="d")
			slot(:name="`${name}-active-option`" v-bind="d")
				slot(name="dropdown-active-option" v-bind="d")
					slot(name="active-option" v-bind="d")
		template(#icon="d")
			slot(:name="`${name}-icon`" v-bind="d")
				slot(name="dropdown-icon" v-bind="d")
		template(#error="d")
			slot(:name="`${name}-error`" v-bind="d")
				slot(name="dropdown-error" v-bind="d")
					slot(name="error" v-bind="d")
		template(#empty="d")
			slot(:name="`${name}-empty`" v-bind="d")
				slot(name="dropdown-empty" v-bind="d")
					slot(name="empty" v-bind="d")
		template(#loading-icon="d")
			slot(:name="`${name}-loading-icon`" v-bind="d")
				slot(name="loading-icon" v-bind="d")
		template(
			v-for="name in slotNames(/-option$/)"
			#[name]="d")
			slot(
				:name="name"
				v-bind="d")

	Formatted(
		v-else-if="is('formatted')"
		v-bind="props")

	List(
		v-else-if="is('list')"
		v-bind="props"
		:symbols="c.symbols")
		template(#form="d")
			slot(:name="`${name}-form`" v-bind="d")
				slot(name="list-form" v-bind="d")
					slot(
						v-if="!$scopedSlots['list-form'] && !$scopedSlots[`${name}-form`]"
						name="form"
						v-bind="d")
		template(#actions-pre="d")
			slot(:name="`${name}-actions-pre`" v-bind="d")
				slot(name="list-actions-pre" v-bind="d")
		template(#delete-icon="d")
			slot(:name="`${name}-delete-icon`" v-bind="d")
				slot(name="list-delete-icon" v-bind="d")
		template(#up-icon="d")
			slot(:name="`${name}-up-icon`" v-bind="d")
				slot(name="list-up-icon" v-bind="d")
		template(#down-icon="d")
			slot(:name="`${name}-down-icon`" v-bind="d")
				slot(name="list-down-icon" v-bind="d")
		template(#actions-post="d")
			slot(:name="`${name}-actions-post`" v-bind="d")
				slot(name="list-actions-post" v-bind="d")

	Media(
		v-else-if="is('media')"
		v-bind="props")
		template(#upload-icon="d")
			slot(:name="`${name}-upload-icon`" v-bind="d")
				slot(name="upload-icon" v-bind="d")
		template(#upload-icon-fill="d")
			slot(:name="`${name}-upload-icon-fill`" v-bind="d")
				slot(name="upload-icon-fill" v-bind="d")
		template(#upload-icon-outline="d")
			slot(:name="`${name}-upload-icon-outline`" v-bind="d")
				slot(name="upload-icon-outline" v-bind="d")
		template(#upload-icon-ripple="d")
			slot(:name="`${name}-upload-icon-ripple`" v-bind="d")
				slot(name="upload-icon-ripple" v-bind="d")
		template(#loading-icon="d")
			slot(:name="`${name}-loading-icon`" v-bind="d")
				slot(name="loading-icon" v-bind="d")
		template(#upload-message="d")
			slot(:name="`${name}-upload-message`" v-bind="d")
				slot(name="upload-message" v-bind="d")
		template(#error-message="d")
			slot(:name="`${name}-error-message`" v-bind="d")
				slot(name="error-message" v-bind="d")

	Multi(
		v-else-if="is('multi')"
		v-bind="props"
		:gap="c.gap"
		:flushWidth="c.flushWidth")
		template(v-slot="d")
			slot(:name="`${name}-option`" v-bind="d")
				slot(name="multi-option" v-bind="d")
		template(
			v-if="$scopedSlots['selection-option'] || $scopedSlots[`${name}-selection-option`]"
			#selection-option="d")
			slot(:name="`${name}-selection-option`" v-bind="d")
				slot(name="selection-option" v-bind="d")
		template(
			v-if="$scopedSlots['selection-option-value'] || $scopedSlots['multi-option-value'] || $scopedSlots[`${name}-option-value`] || $scopedSlots[`${name}-selection-option-valu`]"
			#selection-option-value="d")
			slot(:name="`${name}-selection-option-value`" v-bind="d")
				slot(:name="`${name}-option-value`" v-bind="d")
					slot(name="selection-option-value" v-bind="d")
						slot(name="multi-option-value" v-bind="d")
		template(
			v-if="$scopedSlots['search-result'] || $scopedSlots[`${name}-search-result`]"
			#search-result="d")
			slot(:name="`${name}-search-result`" v-bind="d")
				slot(name="search-result" v-bind="d")
		template(#search-result-value="d")
			slot(:name="`${name}-search-result-value`" v-bind="d")
				slot(:name="`${name}-option-value`" v-bind="d")
					slot(name="search-option-value" v-bind="d")
						slot(name="multi-option-value" v-bind="d")
		template(#error="d")
			slot(:name="`${name}-error`" v-bind="d")
				slot(name="multi-error" v-bind="d")
					slot(name="error" v-bind="d")
		template(#empty="d")
			slot(:name="`${name}-empty`" v-bind="d")
				slot(name="multi-empty" v-bind="d")
					slot(name="empty" v-bind="d")
		template(#loading-icon="d")
			slot(:name="`${name}-loading-icon`" v-bind="d")
				slot(name="loading-icon" v-bind="d")
		template(
			v-for="name in slotNames(/-option$/)"
			#[name]="d")
			slot(
				:name="name"
				v-bind="d")

	Radio(
		v-else-if="is('radio')"
		v-bind="props")
		template(
			v-if="$scopedSlots['radio-option'] || $scopedSlots[`${name}-option`]"
			#option="d")
			slot(:name="`${name}-option`" v-bind="d")
				slot(name="radio-option" v-bind="d")
		template(#label="d")
			slot(:name="`${name}-label`" v-bind="d")
				slot(name="radio-label" v-bind="d")
		template(#description="d")
			slot(:name="`${name}-description`" v-bind="d")
				slot(name="radio-description" v-bind="d")

	TextArea(
		v-else-if="is('textarea')"
		v-bind="props"
		:placeholder="c.placeholder")

	Time(
		v-else-if="is('time')"
		v-bind="props"
		:eagerCollapse="c.eagerCollapse")

	TextInput(
		v-else-if="is(null)"
		v-bind="props"
		:placeholder="c.placeholder")
</template>

<script>
	import Checkbox from "../inputs/checkbox.vue";
	import Coordinates from "../inputs/coordinates.vue";
	import Count from "../inputs/count.vue";
	import Date from "../inputs/date.vue";
	import DateTime from "../inputs/date-time.vue";
	import Dropdown from "../inputs/dropdown.vue";
	import Formatted from "../inputs/formatted.vue";
	import List from "../inputs/list.vue";
	import Media from "../inputs/media.vue";
	import Multi from "../inputs/multi.vue";
	import Radio from "../inputs/radio.vue";
	import TextInput from "../inputs/text.vue";
	import TextArea from "../inputs/textarea.vue";
	import Time from "../inputs/time.vue";

	import utilMixin from "../util-mixin";

	export default {
		name: "InputWrapper",
		mixins: [utilMixin],
		data() {
			const data = {};

			if (this.cell && this.cell.isInputCell)
				data.c = this.cell;
			else {
				data.c = {
					input: this.input || this.cell
				};
			}

			return data;
		},
		methods: {
			is(name) {
				const inp = this.c.input;
				if (!inp || (name !== null && inp.type != name))
					return false;

				return this.verifiedVisibility || inp.visible;
			}
		},
		computed: {
			props() {
				return {
					input: this.c.input,
					disabled: this.disabled == "boolean" ?
						this.disabled :
						this.c.input.disabled,
					readonly: this.readonly == "boolean" ?
						this.readonly :
						this.c.input.readonly,
					meta: this.meta
				};
			},
			name() {
				return this.c.input.name;
			}
		},
		components: {
			Checkbox,
			Coordinates,
			Count,
			Date,
			DateTime,
			Dropdown,
			Formatted,
			List,
			Media,
			Multi,
			Radio,
			TextInput,
			TextArea,
			Time
		},
		props: {
			// Input instance
			input: null,
			cell: Object,
			disabled: Boolean,
			readonly: Boolean,
			meta: Object,
			verifiedVisibility: Boolean
		}
	};
</script>
