<template lang="pug">
	.input-wrapper.radio.inp-radio(:class="validationState")
		.radio-section(v-for="(option, idx) in options"
			:class="{ active: idx == activeIndex }")
			.radio-top
				button.radio-option(
					:disabled="disabled"
					:class="{ custom: $scopedSlots['option'] }"
					@click="trigger(option)")
					slot(name="option" v-bind="wrapOption(option)")
				.label(@click="trigger(option)")
					slot(name="label" v-bind="wrapOption(option)")
						| {{ getLabel(option) }}
			.radio-custom-content-wrapper(v-if="$scopedSlots['custom-content']")
				.radio-custom-content
					slot(name="custom-content" v-bind="wrapOption(option)")
</template>

<script>
	import { Radio } from "@qtxr/form";
	import mixin from "../mixin";
	
	export default {
		name: "Radio",
		mixins: [mixin],
		data: _ => ({
			activeIndex: -1,
			activeOption: {},
			options: []
		}),
		methods: {
			trigger(val) {
				if (!this.disabled)
					this.input.trigger(val);

				this.updateSelection();
			},
			getLabel(option) {
				const label = (option && option.hasOwnProperty("label")) ? option.label : option;
				return typeof label == "object" ? "" : label;
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
				else if (idx == -1 && this.input.value)
					this.trigger()

				this.activeIndex = idx;
				this.activeOption = options[idx] || {};
				this.options = options;
			}
		},
		props: {
			input: Radio
		},
		watch: {
			"input.value"() {
				this.updateSelection();
			}
		},
		beforeMount() {
			this.updateSelection();
			if (this.activeIndex != -1)
				this.input.trigger(this.activeOption);
		},
		beforeUpdate() {
			this.updateSelection();
		}
	};
</script>
