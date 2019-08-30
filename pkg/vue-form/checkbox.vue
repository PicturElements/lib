<template lang="pug">
	.input-wrapper.inp-checkbox(:class="validationState")
		button.checkbox(:class="{ checked: input.value }"
			@click="trigger")
			slot(name="icon" v-bind="input")
				.icon {{ input.value ? "&times;" : "" }}
		.label(v-if="label" @click="trigger") {{ label }}
</template>

<script>
	import Form from "@qtxr/form";

	export default {
		name: "Checkbox",
		data: _ => ({
			validationMsg: null,
			validationState: "ok"
		}),
		methods: {
			trigger() {
				Form.trigger(this.$props.input, !this.$props.input.value);
			}
		},
		props: {
			input: Object,
			label: String
		},
		beforeMount() {
			this.$props.input.hook("update", inp => {
				this.$data.validationState = inp.validationState;
				this.$data.validationMsg = inp.validationMsg || this.$data.validationMsg;
			});
		}
	}
</script>
