<template lang="pug">
	SidebarNav(
		v-if="shouldSkipExpando()"
		:routes="collectChildRoutes()")
	.sidebar-nav-box(v-else)
		template(v-for="route in getRoutes()")
			router-link.sidebar-link.leaf-link(
				v-if="!route.childCount"
				:to="route.path"
				:class="{ 'leaf-active': route.active, hidden: !route.display }")
				span.link-text {{ route.sidebarMeta.name }}
			SidebarNav(
				v-else-if="route.sidebarMeta.display == 'skip'"
				:routes="route.children")
			.sidebar-expando(v-else)
				router-link.sidebar-link.expando-link(
					:to="route.path"
					:class="{ hidden: !route.display }")
					span.link-text {{ route.sidebarMeta.name }}
				SidebarNav(:routes="route.children")
</template>

<script>
	import admin from "../admin";

	const component = admin.wrapC({
		name: "SidebarNav",
		data: {},
		methods: {
			shouldSkipExpando() {
				const routes = this.getRoutes();

				for (let i = 0, l = routes.length; i < l; i++) {
					if (routes[i].sidebarMeta.display != "skip")
						return false;
				}

				return true;
			},
			getRoutes() {
				const routes = this.routes,
					outRoutes = [];

				for (let i = 0, l = routes.length; i < l; i++) {
					const route = routes[i],
						meta = route.view.meta,
						sidebarMeta = meta.sidebar || {},
						children = route.children || [];
					let childCount = 0,
						display = false;

					for (let i = 0, l = children.length; i < l; i++) {
						const childSidebarMeta = children[i].sidebarConfig;

						switch (childSidebarMeta.display) {
							case "hidden":
								break;

							case "active": {
								if (this.matchedRouteHasNode(children[i]))
									childCount++;
								
								break;
							}

							case "visible":
							default:
								childCount++;
								break;
						}
					}

					switch (sidebarMeta.display) {
						case "hidden":
							break;

						case "active": {
							if (this.matchedRouteHasNode(route))
								display = true;
							break;
						}

						case "visible":
						default:
							display = true;
							break;
					}

					const hasNode = this.matchedRouteHasNode(route),
						path = hasNode ? this.resolveParams(route.fullPath) : route.fullPath;

					outRoutes.push({
						path,
						children: route.children,
						active: !childCount && hasNode,
						sidebarMeta,
						childCount,
						display
					});
				}

				return outRoutes;
			},
			resolveParams(path) {
				return path.replace(/:(\w+)/, (match, key) => {
					if (!this.$route.params.hasOwnProperty(key))
						return match;

					return this.$route.params[key];
				});
			},
			matchedRouteHasNode(node) {
				const nodeId = node.meta.id,
					matched = this.$route.matched;

				for (let i = 0, l = matched.length; i < l; i++) {
					const id = matched[i].meta.id;

					if (id == nodeId)
						return true;
				}

				return false;
			},
			collectChildRoutes() {
				let children = [];

				for (let i = 0, l = this.routes.length; i < l; i++)
					children = children.concat(this.routes[i].children);
			
				return children;
			}
		},
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
		
		.expando-link.router-link-active + .sidebar-nav-box {
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

			&.expando-link.router-link-exact-active,
			&.leaf-active {
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

			&.router-link-active:before {
				transform: translateY(-2.5px) rotate(135deg);
			}

			&.router-link-active:not(.router-link-exact-active):after {
				height: 100%;
			}
		}
	}
</style>
