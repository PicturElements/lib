<template lang="pug">
	.ellipsis(:class="[ open ? 'open' : null, menuDirection ]")
		.ellipsis-launcher(
			ref="launcher"
			@click="launchToggleMenu")
			slot(name="icon") ⋯
		.ellipsis-menu(
			:style="menuStyle"
			ref="menu")
			.ellipsis-menu-nub
				slot(name="icon") ⋯
			template(v-for="option in options")
				.ellipsis-menu-item(
					v-if="display(option)"
					:class="{ disabled: disabled(option) }"
					@click="evt => dispatchAction(evt, option)") {{ res(option.title, option) }}
</template>

<script>
	import { requestFrame } from "@qtxr/utils";
	import wc from "@qtxr/vue-wrap-component";

	const PADDING = 30,
		BOTTOM_BIAS = 0.5;

	const component = wc.wrap({
		name: "Ellipsis",
		data: {
			open: false,
			menuStyle: null,
			menuDirection: false,
			updateLoopInitialized: false
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
				this.open = true;
				this.initUpdateLoop();
			},
			closeMenu() {
				this.open = false;
			},
			initUpdateLoop() {
				if (!this.updateLoopInitialized) {
					this.updateLoopInitialized = true;
					this.updateMenu();
				}
			},
			updateMenu() {
				if (!this.open || !this.$refs.menu) {
					this.dropdownStyle = null;
					this.updateLoopInitialized = false;
					return;
				}

				const lbcr = this.$refs.launcher.getBoundingClientRect(),
					mbcr = this.$refs.menu.getBoundingClientRect(),
					bottomAvailable = window.innerHeight - lbcr.bottom - PADDING,
					topAvailable = lbcr.top - PADDING,
					placeBottom = bottomAvailable > mbcr.height,
					maxHeight = placeBottom ? bottomAvailable : topAvailable;

				this.menuStyle = {
					position: "fixed",
					top: placeBottom ? `${lbcr.top + lbcr.height}px` : null,
					bottom: placeBottom ? null : `${window.innerHeight - lbcr.top}px`,
					right: `${window.innerWidth - lbcr.right - 1}px`,
					maxHeight: `${maxHeight}px`
				};

				this.menuDirection = placeBottom ? "place-bottom" : "place-top";

				requestFrame(_ => this.updateMenu());
			},
			display(option) {
				if (typeof option.display == "function")
					return Boolean(option.display(option, this.data));

				return option.hasOwnProperty("display") ? Boolean(option.display) : true;
			},
			disabled(option) {
				if (typeof option.disabled == "function")
					return Boolean(option.disabled(option, this.data));

				return option.hasOwnProperty("disabled") ? Boolean(option.disabled) : true;
			},
			dispatchAction(evt, option) {
				if (this.disabled(option))
					evt.stopPropagation();
				else if (typeof option.action == "function")
					option.action(option, this.data);
			},
			res(val, option) {
				if (typeof val == "function")
					return val.call(this, option, this.data);

				return val;
			}
		},
		computed: {},
		props: {
			options: Array,
			data: null,
			viewport: null
		},
		components: {},
		mounted() {
			this.addEventListener(document, "click", _ => this.closeMenu());
		}
	});

	component.use("events");

	export default component.export();
</script>
