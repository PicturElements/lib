<template lang="pug">
	
</template>

<script>
	import admin from "../admin";
	
	const view = admin.wrap("new-item", {
		name: "NewItem",
		data: {},
		methods: {},
		computed: {},
		props: {},
		components: {}
	});

	export default view.export();
</script>

<style lang="scss">
	@use "../assets/scss" as *;
</style>
