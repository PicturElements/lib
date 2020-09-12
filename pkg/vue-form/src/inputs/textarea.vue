<template lang="pug">
	.input-wrapper.textarea.inp-textarea(:class="classes")
		textarea(
			v-bind="inpPropsFull"
			:value="input.value"
			:aria-invalid="err"
			@keydown="check"
			@input="trigger")
		ValidationMsg(
			:input="input"
			:msg="validationMsg")
</template>

<script>
	import { TextArea } from "@qtxr/form";
	import ValidationMsg from "../core/validation-msg.vue";
	import mixin from "../mixin";

	export default {
		name: "TextArea",
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
			input: TextArea,
			placeholder: [String, Function]
		},
		components: {
			ValidationMsg
		}
	}
</script>
