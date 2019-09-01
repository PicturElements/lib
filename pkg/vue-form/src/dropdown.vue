<template lang="pug">
	.dropdown.inp-dropdown(:class="[ expanded ? 'open' : null, validationState ]"
		ref="dropdownBox")
		button.mobi-focus(@click="expand")
		textarea.focus-probe(@focus="focusExpand"
			@click="expand"
			@blur="desktopCollapse")
		.collapse-target(@click="collapse")
		.dropdown-option.dropdown-active-option
			slot(name="icon" v-bind="$data")
				.icon {{ expanded ? "-" : "+" }}
			.dropdown-option-inner
				span.placeholder(v-if="activeIndex == -1") {{ placeholder }}
				slot(v-else
					v-bind="wrapOption(activeOption)") {{ getLabel(activeOption) }}
		.dropdown-list(:style="listStyle"
			ref="list"
			@mousedown.stop="desktopCollapse")
			template(v-for="(option, idx) in resolve(input.options)")
				.dropdown-option(v-if="idx != activeIndex"
					@mousedown="trigger(option)"
					@click="triggerCollapse(option)")
					.dropdown-option-inner
						slot(v-bind="wrapOption(option)") {{ getLabel(option) }}
				.dropdown-option.selected(v-else)
					.dropdown-option-inner
						slot(v-bind="wrapOption(option)") {{ getLabel(option) }}
</template>

<script>
	import { requestFrame } from "@qtxr/utils";
	import Form from "@qtxr/form";
	
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
			validationState: "ok"
		}),
		methods: {
			nop() {},
			trigger(val) {
				Form.trigger(this.$props.input, val);
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
				console.log(expanded);
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
				this.$data.expanded = true;
				this.initUpdateLoop();
			},
			collapse(evt) {
				this.$data.expanded = false;
			},
			initUpdateLoop() {
				if (!this.$data.updateLoopInitialized) {
					this.$data.updateLoopInitialized = true;
					this.updateFixedList();
				}
			},
			updateFixedList() {
				if (!this.$data.expanded || this.isMobile()) {
					this.$data.listStyle = null;
					this.$data.updateLoopInitialized = false;
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

				this.$data.listStyle = {
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
				const options = this.$props.input.options;
				let idx = options.findIndex(option => {
					return option == this.$props.input.value;
				});

				// Makes a default index if no index was found:
				// 0 with non-empty array
				// -1 with empty array
				if (this.$props.autoSet)
					idx = Math.max(idx, Math.min(options.length - 1, 0));

				this.$data.activeIndex = idx;
				this.$data.activeOption = options[idx] || {};
			},
			resolve(val) {
				if (typeof val == "function")
					return val(this.form, this);

				return val;
			}
		},
		props: {
			input: Object,
			autoSet: Boolean,
			placeholder: String
		},
		beforeMount() {
			this.updateSelection();
			if (this.$data.activeIndex != -1)
				Form.trigger(this.$props.input, this.$data.activeOption);
			
			this.$props.input.hook("update", inp => {
				this.$data.validationState = inp.validationState;
				this.$data.validationMsg = inp.validationMsg || this.$data.validationMsg;
			});
		},
		beforeUpdate() {
			this.updateSelection();
		}
	};
</script>
