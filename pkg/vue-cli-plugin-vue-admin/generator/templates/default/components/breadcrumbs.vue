<template lang="pug">
	.admin-breadcrumbs.f
		router-link.admin-breadcrumb(
			v-for="crumb in breadcrumbs"
			:to="resolveParams(crumb.path)") {{ crumb.crumb }}
</template>

<script>
	import admin from "../admin";

	const component = admin.wrapC({
		name: "Breadcrumbs",
		data: {},
		methods: {
			resolveParams(path) {
				return path.replace(/:(\w+)/, (match, key) => {
					if (!this.$route.params.hasOwnProperty(key))
						return match;

					return this.$route.params[key];
				});
			},
		},
		computed: {
			breadcrumbs() {
				const route = this.$route.meta.route;
				return (route && route.breadcrumbs) || [];
			}
		},
		props: {},
		components: {}
	});

	export default component.export();
</script>

<style lang="scss">
	@use "../assets/scss" as *;

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

	@include mobile {
		.admin-breadcrumbs a {
			&:not(:last-child) {
				display: none;
			}

			&:last-child {
				margin-left: 0;
				
				&:before {
					display: none;
				}
			}
		}
	}
</style>
