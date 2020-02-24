<template lang="pug">
	.admin(:data-path="$route.fullPath")
		//- queryState requires a store, so if you don't currently
		//- need a store for your app, you may safely remove this
		template(v-if="queryState('session.loggedIn')")
			aside.admin-aside.f.col(
				v-if="admin.config.appearance.general.sidebar"
				:class="{ expanded: sidebarExpanded }")
				router-link.admin-aside-overlap.f.c.nshrink(to="/")
					.logo.main-logo
						Icon.ico-logo
					.sidebar-collapse(
						v-if="admin.config.appearance.general.sidebar"
						@click="headerCollapseSidebar")
						Icon.ico-hamburger
				.admin-aside-content(@click="navCollapseSidebar")
					SidebarNav(
						:routes="admin.ui.routing.sidebarNav"
						:admin="admin")
			.admin-inner-content
				header.admin-header
					.sidebar-expand(
						v-if="admin.config.appearance.general.sidebar"
						@click="expandSidebar")
						Icon.ico-hamburger
					Breadcrumbs(
						v-if="admin.config.appearance.general.breadcrumbs"
						:crumbs="admin.ui.routing.breadcrumbs")
					.user-box.f
						.user-name {{ queryState('session.user.firstname') }} {{ queryState('session.user.lastname') }}
						.logout.faux-link.ml10(@click="logout") Log out
				.admin-main-wrapper
					main.admin-main
						router-view
					footer.admin-footer
				.sidebar-collapse-overlay(
					v-if="sidebarExpanded"
					@click="collapseSidebar")
		template(v-else)
			Login
</template>

<script>
	import admin from "../";
	import {
		get,
		hasAncestor
	} from "@qtxr/utils";

	// Load final static assets and finish VueAdmin initialization
	import "../assets/scss/imports.scss";
	import "../assets/scss/style/index.scss";

	admin.init();

	const view = admin.wrap("admin", {
		name: "Admin",
		data: {
			sidebarExpanded: false
		},
		methods: {
			logout() {
				// NB! Requires a store
				this.commit("session/logout");
			},
			expandSidebar() {
				this.sidebarExpanded = true;
			},
			collapseSidebar(evt) {
				this.sidebarExpanded = false;
			},
			headerCollapseSidebar(evt) {
				this.sidebarExpanded = false;
				evt.preventDefault();
			},
			navCollapseSidebar(evt) {
				if (hasAncestor(evt.target, "sidebar-link"))
					this.sidebarExpanded = false;
			}
		},
		computed: {},
		props: {},
		components: {}
	});

	export default view.export();
</script>

<style lang="scss">
	@use "../assets/scss" as *;
</style>
