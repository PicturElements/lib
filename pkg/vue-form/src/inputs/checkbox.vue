<template lang="pug">
	.input-wrapper.checkbox.inp-checkbox(:class="validationState")
		button.checkbox(
			:class="{ checked: input.value }"
			@click="trigger")
			slot(name="icon" v-bind="input")
				.icon {{ input.value ? "&times;" : "" }}
		.label(v-if="res(label)" @click="trigger") {{ res(label) }}
</template>

<script>
	import Form, { Checkbox } from "@qtxr/form";

	export default {
		name: "Checkbox",
		data: _ => ({
			validationMsg: null,
			validationState: "ok"
		}),
		methods: {
			trigger() {
				Form.trigger(this.input, !this.input.value);
			},
			res(val) {
				if (typeof val == "function")
					return val.call(this, this.input);

				return val;
			},
			isMobile() {
				const mobileQuery = this.mobileQuery || this.meta.mobileQuery || "(max-aspect-ratio: 1/1) and (max-width: 700px)";
				return matchMedia(mobileQuery).matches;
			}
		},
		props: {
			input: Checkbox,
			label: String,
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
