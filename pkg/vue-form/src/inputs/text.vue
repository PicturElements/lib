<template lang="pug">
	.input-wrapper.text.inp-text(:class="classes")
		input(
			v-bind="inpPropsFull"
			:value="input.value"
			:type="res(input.type)"
			@keydown="check"
			@input="trigger")
		.validation-msg(:class="validationMsg ? 'active' : null") {{ validationMsg }}
</template>

<script>
	import { Text } from "@qtxr/form";
	import mixin from "../mixin";

	export default {
		name: "TextInput",
		mixins: [mixin],
		methods: {
			trigger(evt) {
				if (!this.inert)
					this.input.trigger(evt.target.value);
			},
			check(evt) {
				this.input.check(evt, evt.target.value);
			}
		},
		props: {
			input: Text,
			placeholder: [String, Function]
		}
	}
</script>
