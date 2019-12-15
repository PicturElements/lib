<template lang="pug">
	.input-wrapper.dropdown.inp-dropdown(:class="[ expanded ? 'open' : null, isMobile() ? 'mobi' : null, validationState, dropdownDirection ]"
		ref="dropdownBox")
		button.mobi-focus(
			:disabled="disabled"
			@click="expand")
		textarea.focus-probe(
			:disabled="disabled"
			@focus="expand"
			@click="triggerExpand"
			@blur="collapse"
			ref="focusProbe")
		.collapse-target(@click="collapse")
		.dropdown-option.dropdown-active-option
			slot(name="icon" v-bind="$data")
				.dropdown-icon.default-icon(:class="{ expanded }") {{ expanded ? "-" : "+" }}
			.dropdown-option-inner
				span.placeholder(v-if="activeIndex == -1")
					| {{ input.placeholder || placeholder }}
				slot(v-else
					v-bind="wrapOption(activeOption)")
					| {{ getLabel(activeOption) }}
		.dropdown-list(:style="listStyle"
			ref="list"
			@mousedown.stop="triggerCollapse")
			template(v-for="(option, idx) in options")
				.dropdown-option(
					v-if="idx != activeIndex"
					@mousedown="trigger(option)"
					@click="trigger(option)")
					.dropdown-option-inner
						slot(v-bind="wrapOption(option)") {{ getLabel(option) }}
				.dropdown-option.selected(v-else)
					.dropdown-option-inner
						slot(v-bind="wrapOption(option)") {{ getLabel(option) }}
</template>

<script>
	import { requestFrame } from "@qtxr/utils";
	import Form, { Dropdown } from "@qtxr/form";
	import EVT from "@qtxr/evt";
	
	const PADDING = 30,
		BOTTOM_BIAS = 0.4;

	export default {
		name: "Dropdown",
		data: _ => ({
			expanded: false,
			dropdownDirection: null,
			bufferedExpanded: false,
			activeIndex: -1,
			activeOption: {},
			listStyle: null,
			updateLoopInitialized: false,
			globalKeyListener: null,
			validationMsg: null,
			validationState: "ok",
			options: []
		}),
		methods: {
			trigger(val) {
				if (!this.disabled)
					this.input.trigger(val);
				this.triggerCollapse();
			},
			getLabel(option) {
				const label = (option && option.hasOwnProperty("label")) ? option.label : option;
				return typeof label == "object" ? "" : label;
			},
			getValue(option) {
				const value = (option && option.hasOwnProperty("label")) ? option.value : option;
				return typeof value == "object" ? "" : value;
			},
			wrapOption(option) {
				if (typeof option != "object")
					return { value: option };

				return option;
			},
			initUpdateLoop() {
				if (!this.updateLoopInitialized) {
					this.updateLoopInitialized = true;
					this.updateFixedList();
				}
			},
			updateFixedList() {
				if (!this.expanded || this.isMobile() || !this.$refs.dropdownBox) {
					this.listStyle = null;
					this.updateLoopInitialized = false;
					return;
				}

				const style = getComputedStyle(this.$refs.dropdownBox),
					bcr = this.$refs.dropdownBox.getBoundingClientRect(),
					sHeight = this.$refs.list.scrollHeight,
					bTop = parseFloat(style.borderTopWidth),
					bRight = parseFloat(style.borderRightWidth),
					bBottom = parseFloat(style.borderBottomWidth),
					bLeft = parseFloat(style.borderLeftWidth),
					topAvailable = bcr.top - PADDING,
					bottomAvailable = window.innerHeight - (bcr.top + bcr.height) - PADDING,
					placeBottom = bottomAvailable > (topAvailable * BOTTOM_BIAS) || sHeight < bottomAvailable,
					maxHeight = placeBottom ? bottomAvailable : topAvailable;

				this.listStyle = {
					position: "fixed",
					top: placeBottom ? `${bcr.top + bcr.height - bBottom}px` : null,
					bottom: placeBottom ? null : `${window.innerHeight - bcr.top - bTop}px`,
					left: `${bcr.left}px`,
					width: `${bcr.width - bLeft - bRight}px`,
					maxHeight: `${maxHeight}px`
				};

				this.dropdownDirection = placeBottom ? "place-bottom" : "place-top";

				requestFrame(_ => this.updateFixedList());
			},
			updateSelection() {
				let options = this.res(this.input.options),
					idx = -1;

				if (!Array.isArray(options))
					options = [];

				this.options = options;

				if (this.activeIndex > -1 && this.activeIndex < options.length && this.input.compare(options[this.activeIndex], this.input.value))
					return;

				for (let i = 0, l = options.length; i < l; i++) {
					if (this.input.compare(options[i], this.input.value)) {
						idx = i;
						break;
					}
				}

				// Makes a default index if no index was found:
				// 0 with non-empty array
				// -1 with empty array
				if (this.input.autoSet)
					idx = Math.max(idx, Math.min(options.length - 1, 0));
				// else if (idx == -1 && this.input.value !== null)
					// this.trigger();

				this.activeIndex = idx;
				this.activeOption = idx > -1 ? options[idx] : {};
				this.input.selectedIndex = idx;
			},
			triggerExpand() {
				if (this.isMobile())
					this.expand();
				else
					this.$refs.focusProbe.focus();
			},
			triggerCollapse() {
				if (this.isMobile())
					this.collapse();
				else
					this.$refs.focusProbe.blur();
			},
			expand() {
				this.expanded = true;
				this.initUpdateLoop();
			},
			collapse(evt) {
				this.expanded = false;
				this.dropdownDirection = null;
			},
			res(val, ...args) {
				if (typeof val == "function")
					return val.call(this, this.input, ...args);

				return val;
			},
			isMobile() {
				const mobileQuery = this.mobileQuery || this.meta.mobileQuery || "(max-aspect-ratio: 1/1) and (max-width: 700px)";
				return matchMedia(mobileQuery).matches;
			}
		},
		props: {
			input: Dropdown,
			disabled: Boolean,
			placeholder: String,
			mobileQuery: String,
			meta: {
				type: Object,
				default: _ => ({})
			}
		},
		watch: {
			"input.value"() {
				this.updateSelection();
			}
		},
		beforeMount() {
			this.updateSelection();
			if (this.activeIndex != -1)
				this.input.updateValue(this.activeOption);

			this.globalKeyListener = evt => {
				if (!this.expanded)
					return;

				switch (EVT.getKey(evt)) {
					case "escape":
						this.triggerCollapse();
						break;
				}
			};
			document.body.addEventListener("keydown", this.globalKeyListener);
			
			this.input.hook("update", inp => {
				this.validationState = inp.validationState;
				this.validationMsg = inp.validationMsg || this.validationMsg;
			});
		},
		beforeUpdate() {
			if (!this.expanded)
				this.updateSelection();
		},
		beforeDestroy() {
			document.body.removeEventListener("keydown", this.globalKeyListener);
		}
	};
</script>
