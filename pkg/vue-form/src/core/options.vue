<template lang="pug">
	.options-wrapper.inner
		template(v-if="context.state.error")
			slot(name="error" v-bind="bnd")
				.error {{ context.state.errorMsg || "Failed to load" }}
		template(v-else-if="context.state.fetches && !context.length")
			slot(name="empty" v-bind="bnd")
				.empty No results found
		.intermediate-padding(v-else-if="!context.state.fetches && context.state.loading")
		.options-scroller(v-else)
			template(
				v-for="option in context.options"
				v-if="option.visible")
				.nested-option(
					v-if="option.type == 'context'"
					:class="{ expanded: option.expanded }")
					button.option.expando.with-icon(
						:class="{ expanded: option.expanded }"
						tabindex="-1"
						@click="toggleExpand(option)")
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
						:input="input"
						:context="option.context"
						:depth="depth + 1"
						:behavior="behavior"
						@trigger="emitTrigger")
						template(
							v-for="(_, name) in $scopedSlots"
							#[name]="d")
							slot(
								:name="name"
								v-bind="d")
				.option(
					v-else
					:class="{ selected: option.selected }"
					@click="dispatch(option)")
					.option-inner
						slot(
							:name="getOptionSlotName(context)"
							v-bind="bindOption(option)")
							slot(v-bind="bindOption(option)") {{ getLabel(option) }}
		.loading-overlay(v-if="context.state.loading")
			slot(name="loading-icon" v-bind="bnd") lol
</template>

<script>
	import EVT from "@qtxr/evt";
	import utilMixin from "../util-mixin";

	export default {
		name: "Options",
		mixins: [utilMixin],
		data() {
			return {
				globalKeyListener: null,
				pointer: [-1]
			};
		},
		methods: {
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
			toggleExpand(option) {
				if (option.expanded)
					option.expanded = false;
				else {
					option.context.search();
					option.expanded = true;
				}
			},
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
			emitTrigger(option) {
				this.$emit("trigger", option);
			},
			getOptionSlotName(context) {
				return `${context.config.name}-option`;
			},
			incrementPointer() {
				// console.log("INCREMENTING");
			},
			decrementPointer() {
				// console.log("DECREMENTING");
			}
		},
		props: {
			input: null,
			context: null,
			active: Boolean,
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
						break;

					case "down":
						this.incrementPointer();
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
