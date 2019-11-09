<template lang="pug">
	
</template>

<script>
	import admin from "%adminPath%";

	const component = admin.wrapC({
		name: "%name%",
		data: {},
		methods: {},
		computed: {},
		props: {},
		components: {}
	});

	export default component.export();
</script>

<style lang="scss">
	@use "%stylePath%" as *;
</style>
