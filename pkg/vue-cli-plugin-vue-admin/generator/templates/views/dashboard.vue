<template lang="pug">
	
</template>

<script>
	import admin from "../admin";
	import components from "../components";

	const view = admin.wrap("dashboard", {
		name: "Dashboard",
		data: {},
		methods: {},
		computed: {},
		props: {},
		components
	});

	export default view.export();
</script>

<style lang="scss">
	@use "../assets/scss/theme.scss" as *;
</style>
