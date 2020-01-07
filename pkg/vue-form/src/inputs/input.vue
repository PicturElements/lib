<template lang="pug">
	.input-wrapper.input.inp-input(:class="validationState")
		input(
			:value="input.value"
			:type="res(input.type)"
			:placeholder="res(input.placeholder || placeholder)"
			:name="res(input.name)"
			:disabled="disabled"
			:autocomplete="ac(input)"
			@keydown="check"
			@input="trigger")
		.validation-msg(:class="validationMsg ? 'active' : null") {{ validationMsg }}
</template>

<script>
	import { Input } from "@qtxr/form";
	import mixin from "../mixin";

	export default {
		name: "Input",
		mixins: [mixin],
		methods: {
			trigger(evt) {
				if (!this.disabled)
					this.input.trigger(evt.target.value);
			},
			check(evt) {
				this.input.check(evt, evt.target.value);
			}
		},
		props: {
			input: Input,
			placeholder: String
		}
	}
</script>
