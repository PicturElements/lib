<template lang="pug">
	.input-wrapper.text.inp-text(:class="classes")
		input(
			v-bind="inpPropsFull"
			:value="input.value"
			:type="res(input.type)"
			:aria-invalid="err"
			@keydown="check"
			@input="trigger"
			@paste="handlePattern")
		ValidationMsg(
			:input="input"
			:msg="validationMsg")
</template>

<script>
	import { Text } from "@qtxr/form";
	import ValidationMsg from "../core/validation-msg.vue";
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
				this.handlePattern(evt);
				this.input.check(evt, evt.target.value);
			}
		},
		props: {
			input: Text,
			placeholder: [String, Function]
		},
		components: {
			ValidationMsg
		}
	}
</script>
