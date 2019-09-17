<template lang="pug">
	.input-wrapper.dropdown.inp-dropdown(:class="[ expanded ? 'open' : null, validationState ]"
		ref="dropdownBox")
		button.mobi-focus(@click="expand")
		textarea.focus-probe(
			@focus="focusExpand"
			@click="expand"
			@blur="desktopCollapse")
		.collapse-target(@click="collapse")
		.dropdown-option.dropdown-active-option
			slot(name="icon" v-bind="$data")
				.icon {{ expanded ? "-" : "+" }}
			.dropdown-option-inner
				span.placeholder(v-if="activeIndex == -1")
					| {{ input.placeholder || placeholder }}
				slot(v-else
					v-bind="wrapOption(activeOption)")
					| {{ getLabel(activeOption) }}
		.dropdown-list(:style="listStyle"
			ref="list"
			@mousedown.stop="desktopCollapse")
			template(v-for="(option, idx) in options")
				.dropdown-option(
					v-if="idx != activeIndex"
					@mousedown="trigger(option)"
					@click="triggerCollapse(option)")
					.dropdown-option-inner
						slot(v-bind="wrapOption(option)") {{ getLabel(option) }}
				.dropdown-option.selected(v-else)
					.dropdown-option-inner
						slot(v-bind="wrapOption(option)") {{ getLabel(option) }}
</template>

<script>
	import Form, { Dropdown } from "@qtxr/form";
	import { requestFrame } from "@qtxr/utils";
	
	const PADDING = 30,
		BOTTOM_BIAS = 0.4;

	export default {
		name: "Dropdown",
		data: _ => ({
			expanded: false,
			bufferedExpanded: false,
			activeIndex: -1,
			activeOption: {},
			listStyle: null,
			updateLoopInitialized: false,
			validationMsg: null,
			validationState: "ok",
			options: []
		}),
		methods: {
			nop() {},
			trigger(val) {
				Form.trigger(this.input, val);
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
			toggleExpansion(expanded) {
				expanded = typeof expanded == "boolean" ? expanded : !this.expanded;

				if (expanded)
					this.collapse();
				else
					this.expand();
			},
			focusExpand() {
				if (!this.isMobile())
					this.expand();
			},
			desktopCollapse() {
				if (!this.isMobile())
					this.collapse();
			},
			triggerCollapse(val) {
				this.trigger(val);
				this.collapse();
			},
			expand() {
				this.expanded = true;
				this.initUpdateLoop();
			},
			collapse(evt) {
				this.expanded = false;
			},
			initUpdateLoop() {
				if (!this.updateLoopInitialized) {
					this.updateLoopInitialized = true;
					this.updateFixedList();
				}
			},
			updateFixedList() {
				if (!this.expanded || this.isMobile()) {
					this.listStyle = null;
					this.updateLoopInitialized = false;
					return;
				}

				const style = getComputedStyle(this.$refs.dropdownBox),
					bcr = this.$refs.dropdownBox.getBoundingClientRect(),
					sHeight = this.$refs.list.scrollHeight,
					bTop = parseFloat(style.borderLeftWidth),
					bRight = parseFloat(style.borderLeftWidth),
					bBottom = parseFloat(style.borderLeftWidth),
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

				requestFrame(_ => this.updateFixedList());
			},
			updateSelection() {
				const options = this.res(this.input.options);

				if (options.hasOwnProperty(this.activeIndex) && this.input.compare(options[this.activeIndex], this.input.value))
					return;

				let idx = options.findIndex(option => {
					return this.input.compare(option, this.input.value);
				});

				// Makes a default index if no index was found:
				// 0 with non-empty array
				// -1 with empty array
				if (this.input.autoSet)
					idx = Math.max(idx, Math.min(options.length - 1, 0));

				this.activeIndex = idx;
				this.activeOption = options[idx] || {};
				this.options = options;
			},
			res(val) {
				if (typeof val == "function")
					return val.call(this, this.form);

				return val;
			}
		},
		props: {
			input: Dropdown,
			placeholder: String
		},
		beforeMount() {
			this.updateSelection();
			if (this.activeIndex != -1)
				Form.trigger(this.input, this.activeOption);
			
			this.input.hook("update", inp => {
				this.validationState = inp.validationState;
				this.validationMsg = inp.validationMsg || this.validationMsg;
			});
		},
		beforeUpdate() {
			this.updateSelection();
		}
	};
</script>
