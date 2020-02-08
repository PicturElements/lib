<template lang="pug">
	.admin-breadcrumbs.f
		router-link.admin-breadcrumb(
			v-for="crumb in crumbs"
			:to="crumb.path") {{ crumb.name }}
</template>

<script>
	export default {
		name: "Breadcrumbs",
		props: {
			crumbs: Array
		}
	};
</script>
