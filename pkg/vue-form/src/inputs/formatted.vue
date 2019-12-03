<template lang="pug">
	.input-wrapper.formatted.inp-formatted
		.formatted-content-editable(
			v-once
			contentEditable="true"
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
	import Form, { Formatted } from "@qtxr/form";

	export default {
		name: "Formatted",
		methods: {
			trigger(count) {
				Form.trigger(this.input, null);
			},
			check(evt) {
				Form.check(this.input, evt, evt.target.value);
			},
			updateSelection() {
				this.input.updateSelectionData(this.$refs.content);
			},
			paste() {
				this.input.catchPaste(this.$refs.content);
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
			input: Formatted,
			mobileQuery: String,
			meta: {
				type: Object,
				default: _ => ({})
			}
		}
	}
</script>
