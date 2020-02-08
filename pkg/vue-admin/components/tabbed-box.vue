<template lang="pug">
	UtilBox.tabbed-box
		template(#title)
			nav.tabbed-nav
				router-link.tabbed-nav-item(
					v-for="route in routes"
					:to="route.path") {{ route.name }}
		slot
</template>

<script>
	export default {
		name: "TabbedBox",
		props: {
			routes: Array
		}
	};
</script>
