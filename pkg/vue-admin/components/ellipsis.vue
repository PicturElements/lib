<template lang="pug">
	.ellipsis(:class="{ open, flipped }")
		.ellipsis-launcher(
			ref="launcher"
			@click="launchToggleMenu")
			Icon.ico-ellipsis
		.ellipsis-menu(ref="menu")
			template(v-for="option in options")
				.ellipsis-menu-item(
					:v-if="display(option)"
					@click="dispatchAction(option)") {{ res(option.title, option) }}
</template>

<script>
	import admin from "../admin";

	import { requestFrame } from "@qtxr/utils";
	import Icon from "./icon.vue";

	const component = admin.wrapC({
		name: "Ellipsis",
		data: {
			open: false,
			flipped: false
		},
		methods: {
			launchToggleMenu() {
				const open = !this.open;

				requestFrame(_ => {
					if (open)
						this.openMenu();
					else
						this.closeMenu();
				});
			},
			openMenu() {
				const mbcr = this.$refs.menu.getBoundingClientRect(),
					viewport = this.getViewportElem();
				
				if (viewport) {
					const lbcr = this.$refs.launcher.getBoundingClientRect(),
						vbcr = viewport.getBoundingClientRect();

					this.flipped = lbcr.bottom + mbcr.height > vbcr.bottom;
				}

				this.open = true;
			},
			closeMenu() {
				this.open = false;
			},
			display(option) {
				if (typeof option.display == "function")
					return Boolean(option.display(option, this.data));

				return option.hasOwnProperty("display") ? Boolean(option.display) : true;
			},
			dispatchAction(option) {
				if (typeof option.action == "function")
					option.action(option, this.data);
			},
			res(val, option) {
				if (typeof val == "function")
					return val.call(this, option, this.data);

				return val;
			},
			getViewportElem() {
				if (!this.viewport)
					return null;
				
				if (typeof this.viewport == "string")
					return document.querySelector(this.viewport);
				
				if (this.viewport instanceof HTMLElement)
					return this.viewport;

				if (this.viewport.$el instanceof HTMLElement)
					return this.viewport.$el;

				return null;
			}
		},
		computed: {},
		props: {
			options: Array,
			data: null,
			viewport: null
		},
		components: {
			Icon
		},
		mounted() {
			this.addEventListener(document, "click", _ => this.closeMenu());
		}
	});

	component.use("events");

	export default component.export();
</script>

<style lang="scss">
	@use "../assets/scss/theme.scss" as *;

	$ellipsis-width: 16px;
	$ellipsis-padding: 8px;
	$ellipsis-border-width: 1px;

	.ellipsis {
		position: relative;
		width: $ellipsis-width;
		height: $ellipsis-width;
		z-index: 10000;

		.ellipsis-launcher {
			position: relative;
			width: $ellipsis-width;
			height: $ellipsis-width;
			padding: $ellipsis-padding;
			margin: -$ellipsis-padding;
			box-sizing: content-box;
			cursor: pointer;
			z-index: 10;

			.adm-icon {
				opacity: 0.5;
			}

			&:hover .adm-icon {
				opacity: 1;
			}
		}

		&.open {
			transform: translateZ(10px);
			z-index: 100000;

			.ellipsis-launcher .adm-icon {
				opacity: 1;
			}
		}

		.ellipsis-menu {
			visibility: hidden;
			position: absolute;
			top: 100%;
			right: -($ellipsis-padding + $ellipsis-border-width);
			padding: $ellipsis-padding;
			margin-top: $ellipsis-padding - $ellipsis-border-width;
			background: $card-background;
			border: 1px solid $main-background;
			border-radius: 2px 0 2px 2px;
			min-width: 100px;

			&:before {
				content: "";
				position: absolute;
				top: -($ellipsis-width + 2 * $ellipsis-padding);
				right: -$ellipsis-border-width;
				width: $ellipsis-width;
				height: $ellipsis-width;
				box-sizing: content-box;
				padding: $ellipsis-padding;
				background: $card-background;
				border: 1px solid $main-background;
				border-bottom-width: 0;
			}

			.ellipsis-menu-item {
				padding: 6px 10px;
				white-space: nowrap;
				cursor: pointer;

				&:hover {
					background: $main-background;
				}
			}
		}

		&:not(.open) .ellipsis-menu {
			position: fixed;
			top: 0;
			left: 0;
		}

		&.open .ellipsis-menu {
			visibility: visible;
		}

		&.flipped {
			.ellipsis-menu {
				top: auto;
				bottom: 100%;
				margin: 0 0 ($ellipsis-padding - $ellipsis-border-width) 0;

				&:before {
					border-top-width: 0;
					border-bottom-width: $ellipsis-border-width;
					top: auto;
					bottom: -($ellipsis-width + 2 * $ellipsis-padding);
				}
			}
		}
	}
</style>
