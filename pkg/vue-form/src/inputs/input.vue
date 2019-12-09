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
				this.input.trigger(evt.target.value);
			},
			check(evt) {
				this.input.check(evt, evt.target.value);
			},
			res(val, ...args) {
				if (typeof val == "function")
					return val.call(this, this.input, ...args);

				return val;
			},
			isMobile() {
				const mobileQuery = this.mobileQuery || this.meta.mobileQuery || "(max-aspect-ratio: 1/1) and (max-width: 700px)";
				return matchMedia(mobileQuery).matches;
			}
		},
		props: {
			input: Input,
			placeholder: String,
			mobileQuery: String,
			meta: {
				type: Object,
				default: _ => ({})
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
