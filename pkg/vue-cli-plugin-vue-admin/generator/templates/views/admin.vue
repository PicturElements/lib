<template lang="pug">
	.admin
		//- queryState requires a store, so if you don't currently
		//- need a store for your app, you may safely remove this
		template(v-if="queryState('session.loggedIn')")
			aside.admin-aside.f.col(
				v-if="admin.config.appearance.general.sidebar"
				:class="{ expanded: sidebarExpanded }")
				router-link.admin-aside-overlap.f.c.nshrink(to="/")
					.logo.main-logo
						Icon.ico-qtxr-logo
					.logo-separator
					.logo-text
						span qtxr
						span admin
					.sidebar-collapse(
						v-if="admin.config.appearance.general.sidebar"
						@click="headerCollapseSidebar")
						Icon.ico-hamburger
				.admin-aside-content(@click="navCollapseSidebar")
					SidebarNav(:routes="admin.ui.routing.sidebarNav")
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

	.admin {
		display: flex;
		flex-direction: row;
		flex-grow: 1;
		align-items: flex-start;
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
			position: relative;
			flex-grow: 0;
			flex-shrink: 0;
			height: 100%;
			width: $sidebar-default-width;
			background: $sidebar-background;
			color: $sidebar-color;
			z-index: 1000000;

			.admin-aside-overlap {
				display: flex;
				align-items: center;
				justify-content: space-between;
				height: $header-height;
				background: $overlap-background;
				padding: 0 $header-horizontal-padding;

				.sidebar-collapse {
					display: none;
					position: absolute;
					top: 0;
					right: 0;
					width: $header-height;
					height: $header-height;
					color: $highlight-complement;
					cursor: pointer;
					z-index: 100;
				}
			}

			.main-logo {
				width: $overlap-logo-width;
				height: $overlap-logo-height;

				.adm-icon {
					height: 100%;
				}
			}

			.logo-text {
				font-size: 150%;
				font-weight: 100;

				span + span {
					font-weight: normal;
					margin-left: 0.15em;
				}
			}

			.logo-separator {
				margin: 0 10px;
				width: 1px;
				height: 50%;
				background: currentColor;
				opacity: 0.2;
			}

			.admin-aside-content {
				overflow: auto;
			}
		}

		.admin-inner-content {
			display: flex;
			flex-direction: column;
			flex-grow: 1;
			width: 100%;
			height: 100%;
			font-size: 120%;
		}

		header {
			position: relative;
			display: flex;
			flex-grow: 0;
			flex-shrink: 0;
			justify-content: space-between;
			align-items: center;
			height: $header-height;
			background: $header-background;
			color: $header-color;
			box-shadow: 0 0 4px rgba(0, 0, 0, 0.07);
			padding: 0 $header-horizontal-padding;
			text-transform: uppercase;
			z-index: 100;

			.sidebar-expand {
				display: none;
				position: absolute;
				top: 0;
				left: 0;
				width: $header-height;
				height: $header-height;
				color: $highlight;
				cursor: pointer;
				z-index: 100;
			}
		}

		.admin-main-wrapper {
			display: flex;
			flex-direction: column;
			overflow: auto;
			flex-grow: 1;
		}

		main {
			position: relative;
			display: flex;
			flex-direction: row;
			align-items: flex-start;
			flex-grow: 1;
		}

		header {
			flex-grow: 0;
			flex-shrink: 0;
			min-height: 50px;
		}

		.admin-padded-wrapper {
			width: 100%;
			margin: 10px 10px 0;

			> .admin-padded-content {
				padding-bottom: 10px;
			}

			&.x-narrow {
				margin: 10px auto 0;
				max-width: 400px;
			}

			&.narrow {
				margin: 10px auto 0;
				max-width: 700px;
			}

			&.semi-narrow {
				margin: 10px auto 0;
				max-width: 1000px;
			}
		}

		@include mobile {
			aside {
				position: fixed;
				top: 0;
				left: 0;
				transition: transform 300ms;
				will-change: transform;
				transform: translateX(-100%);
				z-index: 1000000;

				&.expanded {
					transform: none;
				}
			}

			header {
				padding: 0 $header-horizontal-padding 0 ($header-height + 5px);

				.sidebar-expand {
					display: block;
				}

				.user-name {
					display: none;
				}
			}

			aside .admin-aside-overlap {
				padding: 0 $header-height 0 $header-horizontal-padding;

				.sidebar-collapse {
					display: block;
				}
			}

			.admin-padded-wrapper:not(.mobi-preserve-spacing) {
				width: 100%;
				margin: 0;

				> .admin-padded-content {
					padding: 0;
				}
			}

			.admin-main .admin-padded-wrapper.mobi-preserve-spacing {
				width: 100%;
				padding: 10px 10px 0;
				margin: 0;
			}

			.sidebar-collapse-overlay {
				position: absolute;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				background: rgba(0, 0, 0, 0.2);
				z-index: 999999;
			}
		}
	}
</style>
