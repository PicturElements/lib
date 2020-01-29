<template lang="pug">
	.adm-drop(:class="[ open ? 'open' : null, loading ? 'loading' : null, menuDirection, justifyDirection ]")
		.drop-launcher(
			ref="launcher"
			@click="launchToggleMenu")
			.launcher-content
				slot(
					name="launcher-content"
					v-bind="generalData")
		.drop-menu(:style="menuStyle")
			.drop-menu-nub
				.launcher-content
					slot(
						name="launcher-content"
						v-bind="generalData")
			.drop-menu-content(ref="content")
				.error-content(v-if="cell && cell.state.error")
					slot(name="error" v-bind="this")
						span {{ cell.state.errorMsg || "failed to load data" }}
				.no-content(v-else-if="(!loadable && noItems) || (loadable && cell.state.fetches && noItems)")
					slot(name="no-content") No Content
				template(v-else)
					template(v-for="item in processedItems")
						.drop-menu-item(
							v-if="display(item)"
							:class="{ disabled: disabled(item) }")
							slot(v-bind="{ item, data: processedData, justify, disabled: disabled(item) }")
			slot(
				name="loading-box"
				v-bind="generalData")
				LoadingBox.semi-transparent(
					v-if="cell && $scopedSlots['loading-icon']"
					:cell="cell")
					slot(
						name="loading-icon"
						v-bind="generalData")
</template>

<script>
	import {
		equals,
		requestFrame
	} from "@qtxr/utils";
	import wc from "@qtxr/vue-wrap-component";
	import DataCell from "@qtxr/data-cell";

	const PADDING = 30,
		BOTTOM_BIAS = 0.5;

	const component = wc.wrap({
		name: "Drop",
		data: {
			open: false,
			menuStyle: null,
			menuDirection: null,
			justifyDirection: null,
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
				this.$emit("open", this.generalData);
			},
			closeMenu() {
				this.open = false;
				this.$emit("close", this.generalData);
			},
			initUpdateLoop() {
				if (!this.updateLoopInitialized) {
					this.updateLoopInitialized = true;
					this.updateMenu();
				}
			},
			updateMenu() {
				if (!this.open || !this.$refs.content) {
					this.dropdownStyle = null;
					this.updateLoopInitialized = false;
					return;
				}

				const lbcr = this.$refs.launcher.getBoundingClientRect(),
					cbcr = this.$refs.content.getBoundingClientRect(),
					bottomAvailable = window.innerHeight - lbcr.bottom - PADDING,
					rightAvailable = window.innerWidth - lbcr.right - PADDING,
					topAvailable = lbcr.top - PADDING,
					leftAvailable = lbcr.left - PADDING,
					placeBottom = bottomAvailable > cbcr.height,
					justifyLeft = this.justify != "right" && (leftAvailable > cbcr.width || this.justify != "left"),
					maxHeight = placeBottom ? bottomAvailable : topAvailable;

				const stl = {
					position: "fixed",
					top: placeBottom ? `${lbcr.top + lbcr.height}px` : null,
					bottom: placeBottom ? null : `${window.innerHeight - lbcr.top}px`,
					left: justifyLeft ? `${lbcr.left}px` : null,
					right: justifyLeft ? null : `${window.innerWidth - lbcr.right}px`,
					maxHeight: `${maxHeight}px`
				};

				if (!equals(stl, this.menuStyle)) {
					this.menuStyle = stl;
					this.menuDirection = placeBottom ? "place-bottom" : "place-top";
					this.justifyDirection = justifyLeft ? "justify-left" : "justify-right"
				}

				requestFrame(_ => this.updateMenu());
			},
			display(item) {
				if (!item)
					return false;

				if (typeof item.display == "function")
					return Boolean(item.display(item, this.data));

				return item.hasOwnProperty("display") ?
					Boolean(item.display) :
					true;
			},
			disabled(item) {
				if (!item)
					return true;

				if (typeof item.disabled == "function")
					return Boolean(item.disabled(item, this.data));

				return item.hasOwnProperty("disabled") ?
					Boolean(item.disabled) :
					false;
			}
		},
		computed: {
			loadable() {
				return Boolean(this.cell && this.$scopedSlots['loading-icon']);
			},
			loading() {
				return Boolean(this.loadable && this.cell.state.loading);
			},
			noItems() {
				return !this.processedItems || !this.processedItems.length;
			},
			processedItems() {
				if (this.cell)
					return this.cell.data || [];
				
				return this.items;
			},
			processedData() {
				if (this.cell)
					return this.cell.data;
				
				return this.data;
			},
			generalData() {
				return {
					self: this,
					items: this.processedItems,
					data: this.processedData,
					justify: this.justify
				};
			}
		},
		props: {
			items: Array,
			data: null,
			justify: String,
			cell: DataCell
		},
		components: {},
		mounted() {
			this.addEventListener(document, "click", _ => this.closeMenu());
		}
	});

	component.use("events");

	export default component.export();
</script>
