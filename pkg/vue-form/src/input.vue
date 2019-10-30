<template lang="pug">
	.input-wrapper.input.inp-input(:class="validationState")
		input(
			:value="input.value"
			:type="res(input.type)"
			:placeholder="res(input.placeholder || placeholder)"
			:name="res(input.name)"
			@keydown="check"
			@input="trigger")
		.validation-msg(:class="validationMsg ? 'active' : null") {{ validationMsg }}
</template>

<script>
	import Form, { Input } from "@qtxr/form";

	export default {
		name: "Input",
		data: _ => ({
			validationMsg: null,
			validationState: "ok"
		}),
		methods: {
			trigger(evt) {
				Form.trigger(this.input, evt.target.value);
			},
			check(evt) {
				Form.check(this.input, evt, evt.target.value);
			},
			res(val) {
				if (typeof val == "function")
					return val.call(this, this.form);

				return val;
			}
		},
		props: {
			input: Input,
			placeholder: String
			mobileQuery: String,
			meta: {
				type: Object,
				default: _ => ({})
			},
			isMobile() {
				const mobileQuery = this.mobileQuery || meta.mobileQuery || "(max-aspect-ratio: 1/1) and (max-width: 700px)";
				return matchMedia(mobileQuery).matches;
			}
		},
		beforeMount() {
			this.input.hook("update", inp => {
				this.validationState = inp.validationState;
				this.validationMsg = inp.validationMsg || this.validationMsg;
			});
		}
	}
</script>
