<template lang="pug">
	.radio.inp-radio(:class="validationState")
		.radio-section(v-for="(option, idx) in resolve(input.options)"
			:class="{ active: idx == activeIndex }")
			.radio-top.f.ac
				button.radio-option(@click="trigger(option)")
				.label(@click="trigger(option)")
					slot(name="label" v-bind="wrapOption(option)") {{ getLabel(option) }}
			.radio-custom-content-wrapper(v-if="$scopedSlots['custom-content']")
				.radio-custom-content
					slot(name="custom-content" v-bind="wrapOption(option)")
</template>

<script>
	import Form from "@qtxr/form";
	
	export default {
		name: "Radio",
		data: _ => ({
			activeIndex: -1,
			activeOption: {},
			validationMsg: null,
			validationState: "ok"
		}),
		methods: {
			trigger(val) {
				Form.trigger(this.$props.input, val);
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
				const options = this.$props.input.options;
				let idx = options.findIndex(option => {
					return option == this.$props.input.value;
				});

				// Makes a default index if no index was found:
				// 0 with non-empty array
				// -1 with empty array
				if (this.$props.autoSet)
					idx = Math.max(idx, Math.min(options.length - 1, 0));

				this.$data.activeIndex = idx;
				this.$data.activeOption = options[idx] || {};
			},
			resolve(val) {
				if (typeof val == "function")
					return val(this.form, this);

				return val;
			}
		},
		props: {
			input: Object,
			autoSet: Boolean
		},
		beforeMount() {
			this.updateSelection();
			if (this.$data.activeIndex != -1)
				Form.trigger(this.$props.input, this.$data.activeOption);
			
			this.$props.input.hook("update", inp => {
				this.$data.validationState = inp.validationState;
				this.$data.validationMsg = inp.validationMsg || this.$data.validationMsg;
			});
		},
		beforeUpdate() {
			this.updateSelection();
		}
	};
</script>
