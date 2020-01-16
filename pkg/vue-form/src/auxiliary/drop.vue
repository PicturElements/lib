<template lang="pug">
	.drop-wrapper(:class="[ expanded ? 'open' : null, dropdownDirection ]")
		button.drop-expando-box(
			ref="expando"
			@click="bufferToggle(!expanded)")
			slot(
				name="expando-box"
				v-bind="{ expanded, expand, collapse }")
		.drop-dropdown(
			:style="dropdownStyle"
			ref="dropdown"
			@click.stop)
			slot(v-bind="{ expanded, expand, collapse }")
</template>

<script>
	import {
		equals,
		requestFrame
	} from "@qtxr/utils";
	import EVT from "@qtxr/evt";

	const PADDING = 30,
		BOTTOM_BIAS = 0.5;

	export default {
		name: "Time",
		data: _ => ({
			expanded: false,
			dropdownDirection: null,
			dropdownStyle: null,
			updateLoopInitialized: false,
			globalClickListener: null,
			globalKeyListener: null
		}),
		methods: {
			toggleExpansion(expanded) {
				expanded = typeof expanded == "boolean" ? expanded : !this.expanded;

				if (expanded)
					this.expand();
				else
					this.collapse();
			},
			bufferToggle(expanded) {
				requestFrame(_ => this.toggleExpansion(expanded));
			},
			expand() {
				if (this.expanded)
					return;

				this.expanded = true;
				this.initUpdateLoop();
				this.$emit("expand", this.runtime);
			},
			collapse(evt) {
				if (!this.expanded)
					return;

				this.expanded = false;
				this.dropdownDirection = null;
				this.$emit("collapse", this.runtime);
			},
			initUpdateLoop() {
				if (!this.updateLoopInitialized) {
					this.updateLoopInitialized = true;
					this.updateDropdown();
				}
			},
			updateDropdown() {
				if (!this.expanded || !this.$refs.dropdown) {
					this.dropdownStyle = null;
					this.updateLoopInitialized = false;
					return;
				}

				const style = getComputedStyle(this.$refs.dropdown),
					ebcr = this.$refs.expando.getBoundingClientRect(),
					dbcr = this.$refs.dropdown.getBoundingClientRect(),
					bTop = parseFloat(style.borderTopWidth),
					bLeft = parseFloat(style.borderLeftWidth),
					bRight = parseFloat(style.borderRightWidth),
					bBottom = parseFloat(style.borderBottomWidth),
					brTopLeft = parseFloat(style.borderTopLeftRadius),
					brTopRight = parseFloat(style.borderTopRightRadius),
					brBottomLeft = parseFloat(style.borderBottomLeftRadius),
					brBottomRight = parseFloat(style.borderBottomRightRadius),
					bottomAvailable = window.innerHeight - (ebcr.top + ebcr.height) - PADDING,
					topAvailable = ebcr.top - PADDING,
					placeBottom = bottomAvailable > (topAvailable * BOTTOM_BIAS) || dbcr.height < bottomAvailable - 100,
					maxHeight = placeBottom ? bottomAvailable : topAvailable,
					flushLeft = ebcr.left + dbcr.width < window.innerWidth - PADDING,
					leftShift = flushLeft ?
						0 :
						ebcr.left - (window.innerWidth - PADDING - dbcr.width),
					left = ebcr.left - leftShift,
					rightShift = dbcr.width - ebcr.width - leftShift;

				const stl = {
					position: "fixed",
					top: placeBottom ? `${ebcr.top + ebcr.height - bBottom}px` : null,
					bottom: placeBottom ? null : `${window.innerHeight - ebcr.top - bTop}px`,
					left: `${left - Math.min(rightShift, 0)}px`,
					maxHeight: `${maxHeight}px`
				};

				if (!equals(stl, this.dropdownStyle)) {
					this.dropdownStyle = stl;
					this.dropdownDirection = placeBottom ? "place-bottom" : "place-top";
					
					if (placeBottom) {
						this.dropdownStyle.borderTopLeftRadius = `${Math.min(brBottomLeft, leftShift)}px`;
						this.dropdownStyle.borderTopRightRadius = `${Math.min(brBottomRight, Math.max(rightShift, 0))}px`;
					} else {
						this.dropdownStyle.borderBottomLeftRadius = `${Math.min(brTopLeft, leftShift)}px`;
						this.dropdownStyle.borderBottomRightRadius = `${Math.min(brTopRight, Math.max(rightShift, 0))}px`;
					}
				}

				requestFrame(_ => this.updateDropdown());
			}
		},
		computed: {
			runtime() {
				return {
					expanded: this.expanded,
					expand: this.expand,
					collapse: this.collapse
				};
			}
		},
		beforeMount() {
			this.globalClickListener = _ => this.collapse();
			document.body.addEventListener("click", this.globalClickListener);

			this.globalKeyListener = evt => {
				if (!this.expanded)
					return;

				const key = EVT.getKey(evt);

				switch (key) {
					case "escape":
						this.collapse();
						evt.preventDefault();
						break;
				}

				this.$emit("key", evt, key, this.runtime);
			};
			document.body.addEventListener("keydown", this.globalKeyListener);
		},
		beforeDestroy() {
			document.body.removeEventListener("click", this.globalClickListener);
			document.body.removeEventListener("keydown", this.globalKeyListener);
		}
	};
</script>
