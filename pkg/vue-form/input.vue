<template lang="pug">
	.input-wrapper.inp-input(:class="validationState")
		input(:value="input.value"
			:type="input.type"
			:placeholder="input.placeholder || placeholder"
			:name="input.name"
			@keydown="check"
			@input="trigger")
		.validation-msg(:class="validationMsg ? 'active' : null") {{ validationMsg }}
</template>

<script>
	import Form from "@qtxr/form";

	export default {
		name: "Input",
		data: _ => ({
			validationMsg: null,
			validationState: "ok"
		}),
		methods: {
			trigger(evt) {
				Form.trigger(this.$props.input, evt.target.value);
			},
			check(evt) {
				Form.check(this.$props.input, evt, evt.target.value);
			}
		},
		props: {
			input: Object,
			placeholder: String
		},
		beforeMount() {
			this.$props.input.hook("update", inp => {
				this.$data.validationState = inp.validationState;
				this.$data.validationMsg = inp.validationMsg || this.$data.validationMsg;
			});
		}
	}
</script>
