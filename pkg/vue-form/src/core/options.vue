<template lang="pug">
	.options-wrapper.inner
		template(v-if="context.state.error")
			slot(name="error" v-bind="bind({ query: context.state.query })")
				.error {{ context.state.errorMsg || "Failed to load" }}
		template(v-else-if="context.state.fetches && !context.length")
			slot(name="empty" v-bind="bind({ query: context.state.query })")
				.empty No results found
		.intermediate-padding(v-else-if="!context.state.fetches && context.state.loading")
		ul.options-scroller(
			v-else
			ref="scroller")
			template(
				v-for="(option, idx) in context.options"
				v-if="option.visible")
				li.nested-option(
					v-if="option.type == 'context'"
					:class="{ expanded: option.expanded }"
					tabindex="-1")
					button.option.expando.with-icon(
						:class="{ expanded: option.expanded, pointer: hasPointer(idx) }"
						:aria-expanded="option.expanded"
						:aria-controls="option.uid + '-dropdown'"
						aria-haspopup="true"
						tabindex="-1"
						type="button"
						@click="toggleExpand(option, idx)"
						@keydown="guardExpand($event, option, idx)")
						.option-inner
							slot(
								:name="getOptionSlotName(context)"
								v-bind="bindOption(option)")
								slot(v-bind="bindOption(option)") {{ getLabel(option) }}
						.expando-icon
							slot(name="icon" v-bind="bnd")
								.default-icon.chevron(:class="{ flip: option.expanded }")
					Options(
						v-if="option.expanded"
						:id="option.uid + '-dropdown'"
						:input="input"
						:context="option.context"
						:ptr="passPointer(idx)"
						:depth="depth + 1"
						:behavior="behavior"
						@trigger="emitTrigger"
						@setpointer="acc => setPointer(acc, idx)"
						@invoke="args => invokeRoot(...args)")
						template(
							v-for="(_, name) in $scopedSlots"
							#[name]="d")
							slot(
								:name="name"
								v-bind="d")
				li.option(
					v-else
					:class="{ selected: option.selected, pointer: hasPointer(idx) }"
					:aria-selected="option.selected"
					tabindex="-1"
					@click="dispatch(option)")
					.option-inner
						slot(
							:name="getOptionSlotName(context)"
							v-bind="bindOption(option)")
							slot(v-bind="bindOption(option)") {{ getLabel(option) }}
		.loading-overlay(v-if="context.state.loading")
			slot(name="loading-icon" v-bind="bnd")
</template>

<script>
	import { requestFrame } from "@qtxr/utils";
	import EVT from "@qtxr/evt";
	import utilMixin from "../util-mixin";

	export default {
		name: "Options",
		mixins: [utilMixin],
		data() {
			return {
				globalKeyListener: null,
				pointer: this.depth ? null : [-1]
			};
		},
		methods: {
			// Form interfacing
			dispatch(option) {
				if (this.behavior.toggleOption) {
					if (option.selected)
						this.deselect(option);
					else
						this.select(option);
				} else
					this.select(option);
			},
			select(option) {
				option.select();
				this.emitTrigger(option);
			},
			deselect(option) {
				option.deselect();
				this.emitTrigger(option);
			},
			toggleExpand(option, idx) {
				if (option.expanded)
					option.expanded = false;
				else {
					option.context.search();
					option.expanded = true;
				}

				this.setPointer([], idx);
			},
			guardExpand(evt, option, idx) {
				if (EVT.getKey(evt) == "enter") {
					evt.stopPropagation();
					if (!option.expanded)
						this.invokeRoot("scrollToPointer");
				}
			},
			emitTrigger(option) {
				this.$emit("trigger", option);
			},

			// Render utilities
			getLabel(option) {
				option = option.value;
				const label = (option && option.hasOwnProperty("label")) ?
					option.label :
					option;

				return typeof label == "object" ? "" : label;
			},
			getValue(option) {
				option = option.value;
				const value = (option && option.hasOwnProperty("value")) ?
					option.value :
					option;

				return typeof value == "object" ? "" : value;
			},
			getOptionSlotName(context) {
				return `${context.config.name}-option`;
			},
			bindOption(option) {
				return this.bind({
					fullOption: option,
					option: option.value,
					selected: option.selected,
					select: _ => this.select(option),
					deselect: _ => this.deselect(option),
					dispatch: _ => this.dispatch(option)
				});
			},
			hasPointer(idx) {
				const ptr = this.pointer || this.ptr;

				if (this.depth != ptr.length - 1)
					return false;

				return idx == ptr[this.depth];
			},
			passPointer(idx) {
				const ptr = this.pointer || this.ptr;

				if (ptr[this.depth] != idx)
					return [-1];

				return ptr;
			},

			// Root level methods: pointer
			incrementPointer() {
				const ptr = this.pointer;

				const apply = (options, parentOptions, ptrIdx) => {
					const ptrVal = ptr[ptrIdx],
						option = options[ptrVal];
					let isLeaf = ptrIdx == ptr.length - 1;

					if (isLeaf) {
						if (option && option.type == "context" && option.expanded && this.hasVisibleOptions(option.context.options)) {
							ptr.push(this.getFirstPointerIndex(option.context.options));
							return true;
						}

						const nextIdx = this.getNextPointerIndex(options, ptrVal);

						if (nextIdx != -1) {
							ptr.splice(ptrIdx, 1, nextIdx);
							return true;
						}

						if (!parentOptions) {
							this.pointer = [this.getFirstPointerIndex(options)];
							return true;
						}

						ptr.pop();
						return false;
					}

					if (!option || option.type != "context" || !option.expanded) {
						this.pointer = ptr.slice(0, ptrIdx);
						return false;
					}

					if (apply(option.context.options, options, ptrIdx + 1))
						return true;

					isLeaf = ptrIdx == ptr.length - 1;

					if (isLeaf) {
						const nextIdx = this.getNextPointerIndex(options, ptrVal);

						if (nextIdx != -1) {
							ptr.splice(ptrIdx, 1, nextIdx);
							return true;
						}

						if (!parentOptions) {
							this.pointer = [this.getFirstPointerIndex(options)];
							return true;
						}
					}

					ptr.pop();
					return false;
				};

				apply(this.input.optionsContext.options, null, 0);
				this.focusPointer();
				this.$emit("pointermove", {
					pointer: this.pointer,
					mode: "increment"
				});
			},
			decrementPointer() {
				const ptr = this.pointer;

				const apply = (options, parentOptions, ptrIdx) => {
					const ptrVal = ptr[ptrIdx],
						option = options[ptrVal],
						dive = ptrIdx < ptr.length - 1;

					if (dive && option && option.type == "context" && option.expanded) {
						if (apply(option.context.options, options, ptrIdx + 1))
							return true;
					}

					let isLeaf = ptrIdx == ptr.length - 1;

					if (isLeaf) {
						if (dive)
							return true;

						const prevIdx = this.getPrevPointerIndex(options, ptrVal),
							prevOption = options[prevIdx];

						if (prevIdx != -1) {
							ptr.splice(ptrIdx, 1, prevIdx);
							if (!prevOption || prevOption.type != "context" || !prevOption.expanded)
								return true;
						} else if (parentOptions) {
							ptr.pop();
							return false;
						}

						let targetOption = prevIdx == -1 ?
							options[this.getLastPointerIndex(options)] :
							prevOption;

						if (!targetOption)
							return false;

						while (true) {
							const opts = targetOption.context.options;

							if (targetOption.type == "context" && targetOption.expanded && this.hasVisibleOptions(opts)) {
								const idx = this.getLastPointerIndex(opts);
								ptr.push(idx);
								targetOption = opts[idx];
							} else {
								if (ptrIdx == 0 && prevIdx == -1)
									ptr.splice(ptrIdx, 1, this.getLastPointerIndex(options));
								return true;
							}
						}
					}

					return false;
				};

				apply(this.input.optionsContext.options, null, 0);
				this.focusPointer();
				this.$emit("pointermove", {
					pointer: this.pointer,
					mode: "decrement"
				});
			},
			getNextPointerIndex(options, idx) {
				return this.getPointerIndex(options, idx, "increment");
			},
			getPrevPointerIndex(options, idx) {
				return this.getPointerIndex(options, idx, "decrement");
			},
			getFirstPointerIndex(options) {
				return this.getPointerIndex(options, -1, "increment");
			},
			getLastPointerIndex(options) {
				return this.getPointerIndex(options, options.length, "decrement");
			},
			getPointerIndex(options, idx, mode) {
				if (mode == "increment") {
					for (let i = idx + 1, l = options.length; i < l; i++) {
						if (options[i].visible)
							return i;
					}
				} else {
					for (let i = idx - 1; i >= 0; i--) {
						if (options[i].visible)
							return i;
					}
				}

				return -1;
			},
			selectWithPointer() {
				const ptr = this.pointer;
				let options = this.input.optionsContext.options,
					option = null;

				for (let i = 0, l = ptr.length; i < l; i++) {
					option = options[ptr[i]];

					if (!option)
						return;
					if (i == l - 1 || option.type != "context")
						break;

					options = option.context.options;
				}

				if (option.type == "context")
					this.toggleExpand(option);
				else
					this.dispatch(option);
			},
			hasVisibleOptions(options) {
				for (let i = 0, l = options.length; i < l; i++) {
					if (options[i].visible)
						return true;
				}

				return false;
			},

			// Root level methods: scroll/focus
			scrollToPointer() {
				requestFrame(_ => this.scrollTo(".option.pointer"));
			},
			focusPointer() {
				requestFrame(_ => this.focus(".option.pointer"));
			},
			scrollTo(nodeOrSelector) {
				const scroller = this.$refs.scroller;
				let node = nodeOrSelector;
				if (!scroller)
					return null;

				if (typeof nodeOrSelector == "string")
					node = scroller.querySelector(nodeOrSelector);

				if (!node)
					return null;

				const sbcr = scroller.getBoundingClientRect(),
					nbcr = node.getBoundingClientRect(),
					delta = nbcr.top - (sbcr.top + ((sbcr.height - nbcr.height) / 2));

				scroller.scrollTop += delta;
				return node;
			},
			focus(nodeOrSelector) {
				const node = this.scrollTo(nodeOrSelector);
				if (node)
					node.focus();
			},

			// Inter-component communication
			setPointer(acc, idx) {
				acc.push(idx);

				if (this.depth)
					this.$emit("setpointer", acc);
				else {
					acc.reverse();
					this.pointer = acc;
				}
			},
			invokeRoot(...args) {
				if (this.depth)
					this.$emit("invoke", args);
				else {
					const [method, ...a] = args;
					this[method](...a);
				}
			}
		},
		watch: {
			updates() {
				this.pointer = [-1];

				requestFrame(_ => {
					if (this.input.optionsContext.globalConfig.maxSelected == 1)
						this.scrollTo(".option.selected");
					else {
						const scroller = this.$refs.scroller;
						if (scroller)
							scroller.scrollTop = 0;
					}
				});
			}
		},
		props: {
			input: null,
			context: null,
			active: Boolean,
			updates: Number,
			ptr: Array,
			depth: {
				type: Number,
				default: 0
			},
			behavior: {
				type: Object,
				default: _ => ({})
			}
		},
		mounted() {
			if (this.depth)
				return;

			this.globalKeyListener = evt => {
				if (!this.active)
					return;

				switch (EVT.getKey(evt)) {
					case "up":
						this.decrementPointer();
						evt.preventDefault();
						break;

					case "down":
						this.incrementPointer();
						evt.preventDefault();
						break;

					case "enter":
						this.selectWithPointer();
						evt.preventDefault();
						break;
				}
			};

			document.body.addEventListener("keydown", this.globalKeyListener);
		},
		beforeDestroy() {
			if (!this.depth)
				document.body.removeEventListener("keydown", this.globalKeyListener);
		}
	};
</script>
