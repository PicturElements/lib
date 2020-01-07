<template lang="pug">
	.input-wrapper.checkbox.inp-checkbox(:class="validationState")
		button(
			:class="{ checked: input.value }"
			:disabled="disabled"
			@click="trigger")
			slot(name="icon" v-bind="input")
				.icon {{ input.value ? "&times;" : "" }}
		.label(v-if="res(label)" @click="trigger") {{ res(label) }}
</template>

<script>
	import { Checkbox } from "@qtxr/form";
	import mixin from "../mixin";

	export default {
		name: "Checkbox",
		mixins: [mixin],
		methods: {
			trigger() {
				if (!this.disabled)
					this.input.trigger(!this.input.value);
			}
		},
		props: {
			input: Checkbox,
			label: String
		}
	}
</script>
