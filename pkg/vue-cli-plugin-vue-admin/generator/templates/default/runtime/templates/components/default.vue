<template lang="pug">
	
</template>

<script>
	import admin from "../admin";
	import * as components from "@qtxr/vue-admin/components";

	const component = admin.wrapC({
		name: "%name%",
		data: {},
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
