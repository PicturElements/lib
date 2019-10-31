<template lang="pug">
	
</template>

<script>
	import admin from "../admin";
	import * as components from "@qtxr/vue-admin/components";

	const view = admin.wrap("dashboard", {
		name: "Dashboard",
		data: {},
		methods: {},
		computed: {},
		props: {},
		components: {
			...components
		}
	});

	export default view.export();
</script>

<style lang="scss">
	@use "../assets/scss/theme.scss" as *;
</style>
