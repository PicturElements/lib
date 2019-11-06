<template lang="pug">
	.input-wrapper.radio.inp-radio(:class="validationState")
		.radio-section(v-for="(option, idx) in options"
			:class="{ active: idx == activeIndex }")
			.radio-top
				button.radio-option(@click="trigger(option)")
				.label(@click="trigger(option)")
					slot(name="label" v-bind="wrapOption(option)")
						| {{ getLabel(option) }}
			.radio-custom-content-wrapper(v-if="$scopedSlots['custom-content']")
				.radio-custom-content
					slot(name="custom-content" v-bind="wrapOption(option)")
</template>

<script>
	import Form, { Radio } from "@qtxr/form";
	
	export default {
		name: "Radio",
		data: _ => ({
			activeIndex: -1,
			activeOption: {},
			validationMsg: null,
			validationState: "ok",
			options: []
		}),
		methods: {
			trigger(val) {
				Form.trigger(this.input, val);
				this.updateSelection();
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
			updateSelection() {
				const options = this.res(this.input.options);
				
				if (options.hasOwnProperty(this.activeIndex) && this.input.compare(options[this.activeIndex], this.input.value))
					return;

				let idx = options.findIndex(option => {
					return this.input.compare(option, this.input.value);
				});

				// Makes a default index if no index was found:
				// 0 with non-empty array
				// -1 with empty array
				if (this.input.autoSet)
					idx = Math.max(idx, Math.min(options.length - 1, 0));

				this.activeIndex = idx;
				this.activeOption = options[idx] || {};
				this.options = options;
			},
			res(val) {
				if (typeof val == "function")
					return val.call(this, this.form, this.input);

				return val;
			},
			isMobile() {
				const mobileQuery = this.mobileQuery || this.meta.mobileQuery || "(max-aspect-ratio: 1/1) and (max-width: 700px)";
				return matchMedia(mobileQuery).matches;
			}
		},
		props: {
			input: Radio,
			mobileQuery: String,
			meta: {
				type: Object,
				default: _ => ({})
			}
		},
		beforeMount() {
			this.updateSelection();
			if (this.activeIndex != -1)
				Form.trigger(this.input, this.activeOption);
			
			this.input.hook("update", inp => {
				this.validationState = inp.validationState;
				this.validationMsg = inp.validationMsg || this.validationMsg;
			});
		},
		beforeUpdate() {
			this.updateSelection();
		}
	};
</script>
