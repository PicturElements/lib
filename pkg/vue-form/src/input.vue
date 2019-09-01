<template lang="pug">
	.input-wrapper.inp-input(:class="validationState")
		input(:value="input.value"
			:type="resolve(input.type)"
			:placeholder="resolve(input.placeholder || placeholder)"
			:name="resolve(input.name)"
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
			},
			resolve(val) {
				if (typeof val == "function")
					return val(this.form, this);

				return val;
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
