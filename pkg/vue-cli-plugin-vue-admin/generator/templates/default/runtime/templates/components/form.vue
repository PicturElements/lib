<template lang="pug">
	.login-form
		VForm(
			:form="form"
			:rows="rows")
		button(:disabled="!form.valid")
</template>

<script>
	import admin from "../admin";
	import * as components from "@qtxr/vue-admin/components";

	import Form from "@qtxr/form";

	const component = admin.wrapC({
		name: "%name%",
		data() {
			return {
				form: new Form("std"),
				rows: [
					Form.mod("email", {
						name: "email",
						title: "Email"
					})
				]
			}
		},
		methods: {},
		computed: {},
		props: {},
		components: {
			...components
		}
	});

	export default component.export();
</script>

<style lang="scss">
	@use "../assets/scss/theme.scss" as *;
</style>
