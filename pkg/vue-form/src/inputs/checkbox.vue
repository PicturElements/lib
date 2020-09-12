<template lang="pug">
	.input-wrapper.checkbox.inp-checkbox(:class="classes")
		button(
			:id="input.uid"
			:class="{ checked: input.value }"
			:disabled="inert"
			:aria-checked="input.value"
			:aria-invalid="err"
			:aria-labelledby="input.uid + (res(label) ? '-label' : '-title')"
			type="button"
			role="checkbox"
			@click="trigger")
			slot(name="icon" v-bind="bind('checked')")
				.icon {{ input.value ? "&times;" : "" }}
		label.label(
			v-if="res(label)"
			:id="input.uid + '-label'"
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
