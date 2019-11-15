<template lang="pug">
	.sidebar-nav-box(v-else)
		template(v-for="route in routes")
			router-link.sidebar-link.leaf-link(
				v-if="!route.children.length"
				:to="route.path"
				:class="{ active: route.active, 'active-route': route.activeRoute }")
				span.link-text {{ route.name }}
			.sidebar-expando(v-else)
				router-link.sidebar-link.expando-link(
					:to="route.path"
					:class="{ active: route.active, 'active-route': route.activeRoute }")
					span.link-text {{ route.name }}
				SidebarNav(:routes="route.children")
</template>

<script>
	import admin from "../admin";

	const component = admin.wrapC({
		name: "SidebarNav",
		data: {},
		methods: {},
		computed: {},
		props: {
			routes: Array
		},
		components: {}
	});

	export default component.export();
</script>

<style lang="scss">
	@use "../assets/scss" as *;

	.sidebar-nav-box {
		.sidebar-nav-box {
			display: none;
			border-left: 8px solid $sidebar-overlay-background;
		}
		
		.expando-link.active-route + .sidebar-nav-box {
			display: block;
		}
		
		.sidebar-link {
			display: block;
			position: relative;
			padding: 12px 15px;
			font-size: 120%;

			&:after {
				content: "";
				position: absolute;
				bottom: 0;
				left: 0;
				width: 100%;
				height: 1px;
				background: $sidebar-overlay-background;
				z-index: 0;
			}

			&.active {
				background: $highlight;

				&:after {
					display: none;
				}
			}

			&.hidden {
				display: none;
			}

			.link-text {
				position: relative;
				z-index: 10;
			}
		}

		.sidebar-expando {
			position: relative;

			.sidebar-expando {
				border-left: 1px solid $sidebar-background;
			}
		}

		.expando-link {
			&:before {
				content: "";
				position: absolute;
				top: 50%;
				right: 18px;
				width: 9px;
				height: 9px;
				border: 1px solid;
				border-left: none;
				border-bottom: none;
				border-radius: 1px;
				transform: translateY(-3px) rotate(45deg);
				transform-origin: 70% 30%;
				transition: transform 300ms;
			}

			&.active-route:before {
				transform: translateY(-2.5px) rotate(135deg);
			}

			&.active-route:not(.active):after {
				height: auto;
				top: 1px;
			}
		}
			
		> * + .sidebar-expando > .expando-link.active-route:after {
			top: 0;
		}
	}
</style>
