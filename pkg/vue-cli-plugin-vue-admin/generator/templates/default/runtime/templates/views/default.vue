<template lang="pug">
	.admin-padded-wrapper.medium-width
		.admin-padded-content
</template>

<script>
	import admin from "%adminPath%";

	const view = admin.wrap("%fileName%", {
		name: "%viewName%",
		data: {},
		methods: {},
		computed: {},
		props: {},
		components: {}
	});

	export default view.export();
</script>

<style lang="scss">
	@use "%stylePath%" as *;
</style>
