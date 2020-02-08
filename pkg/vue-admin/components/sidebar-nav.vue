<template lang="pug">
	.sidebar-nav-box(:class="{ 'pre-expand': preExpand }")
		template(v-for="route in routes")
			router-link.sidebar-link.leaf-link(
				v-if="!route.children.length"
				:to="route.path"
				:class="{ active: route.active, 'active-route': route.activeRoute }")
				.link-text {{ route.name }}
			.sidebar-expando(v-else)
				router-link.sidebar-link.expando-link(
					:to="route.path"
					:class="{ active: route.active, 'active-route': route.activeRoute, 'pre-expanded': isPreExpanded(route) }")
					.link-text {{ route.name }}
					.expando-box
						svg.square-fill(viewBox="0 0 1 1")
						.pre-expand-expando(
							v-if="preExpand"
							@click.stop.prevent="setExpandedRoute(route)")
				SidebarNav(
					:routes="route.children"
					:expandedRoute="expandedR"
					:admin="admin"
					@propagate="propagateExpandedRoute")
</template>

<script>
	import { get } from "@qtxr/utils";

	export default {
		name: "SidebarNav",
		data() {
			return {
				expandedR: this.expandedRoute || null
			};
		},
		methods: {
			setExpandedRoute(route) {
				if (!route)
					this.propagateExpandedRoute(null);
				else {
					const id = route.route.meta.id;

					if (id == this.expandedR)
						this.propagateExpandedRoute(null);
					else
						this.propagateExpandedRoute(id);
				}
			},
			propagateExpandedRoute(id) {
				if (this.depth == 0)
					this.expandedR = id;

				this.$emit("propagate", id);
			},
			isPreExpanded(route) {
				if (!this.expandedR)
					return false;

				return this.expandedR.indexOf(route.route.meta.id) == 0;
			}
		},
		computed: {
			preExpand() {
				return get(this.admin, "config.behavior.routing.sidebar.preExpand");
			}
		},
		watch: {
			"admin.ui.routing.currentRoute"() {
				this.setExpandedRoute(null);
			}
		},
		props: {
			routes: Array,
			admin: null,
			expandedRoute: String,
			depth: {
				type: Number,
				default: 0
			}
		}
	};
</script>
