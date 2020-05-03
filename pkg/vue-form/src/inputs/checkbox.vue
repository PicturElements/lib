<template lang="pug">
	.input-wrapper.checkbox.inp-checkbox(:class="classes")
		button(
			:class="{ checked: input.value }"
			:disabled="inert"
			@click="trigger")
			slot(name="icon" v-bind="bind('checked')")
				.icon {{ input.value ? "&times;" : "" }}
		.label(
			v-if="res(label)"
			@click="trigger") {{ res(label) }}
</template>

<script>
	import { Checkbox } from "@qtxr/form";
	import mixin from "../mixin";

	export default {
		name: "Checkbox",
		mixins: [mixin],
		methods: {
			trigger() {
				if (!this.inert)
					this.input.trigger(!this.input.value);
			}
		},
		props: {
			input: Checkbox,
			label: [String, Function]
		}
	}
</script>
