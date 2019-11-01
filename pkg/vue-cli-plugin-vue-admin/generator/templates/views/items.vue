<template lang="pug">
	
</template>

<script>
	import admin from "../admin";
	import components from "../components";

	const view = admin.wrap("items", {
		name: "Items",
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
