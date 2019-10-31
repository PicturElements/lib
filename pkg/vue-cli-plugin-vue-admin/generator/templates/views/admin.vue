<template lang="pug">
	.admin
		//- queryState requires a store, so if you don't currently
		//- need a store for your app, you may safely remove this
		template(v-if="queryState('session.loggedIn')")
			aside.admin-aside.f.col(v-if="admin.config.appearance.general.sidebar")
				router-link.admin-aside-overlap.f.c.nshrink(to="/")
					.logo.main-logo
						Icon.ico-qtxr-logo
					.logo-separator
					.logo-text
						span qtxr
						span admin
				.admin-aside-content
					SidebarNav(:routes="admin.routes")
			.admin-inner-content
				header.admin-header
					.admin-breadcrumbs.f(v-if="admin.config.appearance.general.breadcrumbs")
						router-link.admin-breadcrumb(
							v-for="crumb in breadcrumbs"
							:to="crumb.path") {{ crumb.crumb }}
					.logout.faux-link(@click="logout") Log out
				.admin-main-wrapper
					main.admin-main
						router-view
					footer.admin-footer
		template(v-else)
			Login
</template>

<script>
	import admin from "../admin";
	import * as components from "@qtxr/vue-admin/components";

	import Login from "../components/login.vue";
	import SidebarNav from "../components/sidebar-nav.vue";
	import Icon from "../components/icon.vue";

	// Load final static assets and finish VueAdmin initialization
	import "../assets/scss/imports.scss";
	import "../assets/scss/style";
	admin.init();

	const view = admin.wrap("admin", {
		name: "Admin",
		data: {},
		methods: {
			logout() {
				// NB: Requires a store
				this.commit("session/logout");
			}
		},
		computed: {
			breadcrumbs() {
				const route = this.$route.meta.route;
				return (route && route.breadcrumbs) || [];
			}
		},
		props: {},
		components: {
			...components,
			Login,
			SidebarNav,
			Icon
		}
	});

	export default view.export();
</script>

<style lang="scss">
	@use "../assets/scss/theme.scss" as *;

	.admin {
		display: flex;
		flex-direction: row;
		flex-grow: 1;
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		font-size: 10px;
		background: $main-background;
		color: $main-color;
		z-index: 1000;

		aside {
			flex-grow: 0;
			flex-shrink: 0;
			width: $sidebar-default-width;
			background: $sidebar-background;
			color: $sidebar-color;

			.admin-aside-overlap {
				display: flex;
				align-items: center;
				justify-content: space-between;
				height: $header-height;
				background: $overlap-background;
				padding: 0 20px 0 15px;
			}

			.main-logo {
				height: $overlap-logo-height;
				color: $highlight;

				.adm-icon {
					height: 100%;
				}
			}

			.admin-aside-content {
				overflow: auto;
			}
		}

		.admin-inner-content {
			display: flex;
			flex-direction: column;
			flex-grow: 1;
			font-size: 120%;
		}

		header {
			display: flex;
			flex-grow: 0;
			flex-shrink: 0;
			justify-content: space-between;
			align-items: center;
			height: $header-height;
			background: $header-background;
			color: $header-color;
			box-shadow: 0 0 4px rgba(0, 0, 0, 0.07);
			padding: 0 18px;
			text-transform: uppercase;
			z-index: 100;

			.admin-breadcrumb {
				position: relative;

				+ .admin-breadcrumb {
					margin-left: 1.6em;

					&:before {
						content: "";
						position: absolute;
						width: 0.6em;
						height: 0.6em;
						top: 50%;
						margin: -0.25em -1.25em;
						transform: rotate(45deg);
						border: 1px solid $header-color;
						border-style: dotted;
						border-left: none;
						border-bottom: none;
						opacity: 0.7;
					}
				}

				&:last-child {
					color: $highlight;
					font-weight: bold;
				}
			}
		}

		.admin-main-wrapper {
			display: flex;
			flex-direction: column;
			overflow: auto;
			flex-grow: 1;
		}

		main {
			display: flex;
			flex-direction: row;
			flex-grow: 1;
		}

		header {
			flex-grow: 0;
			flex-shrink: 0;
			min-height: 50px;
		}
	}
</style>
