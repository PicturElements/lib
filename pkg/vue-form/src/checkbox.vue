<template lang="pug">
	.input-wrapper.inp-checkbox.f.ac.fs90(:class="validationState")
		button.checkbox(
			:class="{ checked: input.value }"
			@click="trigger")
			slot(name="icon" v-bind="input")
				.icon {{ input.value ? "&times;" : "" }}
		.label(v-if="res(input.label || label)" @click="trigger") {{ res(input.label || label) }}
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
				Form.trigger(this.input, !this.input.value);
			},
			res(val) {
				if (typeof val == "function")
					return val.call(this, this.form);

				return val;
			}
		},
		props: {
			input: Object,
			label: String
		},
		beforeMount() {
			this.input.hook("update", inp => {
				this.validationState = inp.validationState;
				this.validationMsg = inp.validationMsg || this.validationMsg;
			});
		}
	}
</script>
