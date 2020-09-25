<template lang="pug">
	.input-wrapper(:class="cl(inputName, `inp-${inputName}`)")
		slot(v-bind="$props")
</template>

<script>
	import { AbstractInput } from "@qtxr/form";
	import {
		casing,
		getConstructorName
	} from "@qtxr/utils";

	import mixin from "../mixin";

	export default {
		name: "AbstractInput",
		mixins: [mixin],
		methods: {},
		computed: {
			inputName() {
				return casing(
					getConstructorName(this.input)
				).to("kebab");
			}
		},
		props: {
			input: AbstractInput
		}
	}
</script>
