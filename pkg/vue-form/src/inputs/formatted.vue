<template lang="pug">
	.input-wrapper.formatted.inp-formatted
		.formatted-content-editable(
			v-once
			:contentEditable="!disabled"
			@click="updateSelection"
			@focus="updateSelection"
			@paste="paste"
			ref="content")
			| test,
			span in span,
			span
				| in span again,
				span span in span
</template>

<script>
	import { Formatted } from "@qtxr/form";
	import mixin from "../mixin";

	export default {
		name: "Formatted",
		mixins: [mixin],
		methods: {
			trigger(count) {
				if (!this.disabled)
					this.input.trigger(null);
			},
			check(evt) {
				this.input.check(evt, evt.target.value);
			},
			updateSelection() {
				this.input.updateSelectionData(this.$refs.content);
			},
			paste() {
				this.input.catchPaste(this.$refs.content);
			}
		},
		props: {
			input: Formatted
		}
	}
</script>
