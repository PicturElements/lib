<template lang="pug">
	.ellipsis(:class="{ open, flipped }")
		.ellipsis-launcher(
			ref="launcher"
			@click="launchToggleMenu")
			slot(name="icon") ⋯
		.ellipsis-menu(ref="menu")
			template(v-for="option in options")
				.ellipsis-menu-item(
					:v-if="display(option)"
					@click="dispatchAction(option)") {{ res(option.title, option) }}
</template>

<script>
	import { requestFrame } from "@qtxr/utils";
	import wc from "@qtxr/vue-wrap-component";

	const component = wc.wrap({
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
		components: {},
		mounted() {
			this.addEventListener(document, "click", _ => this.closeMenu());
		}
	});

	component.use("events");

	export default component.export();
</script>
