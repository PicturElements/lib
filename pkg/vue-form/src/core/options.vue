<template lang="pug">
	.options-wrapper
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
						@trigger="emitTrigger")
						template(
							v-for="(_, name) in $scopedSlots"
							#[name]="d")
							slot(
								:name="name"
								v-bind="d")
				.option(
					v-else
					:class="{ selected: option.selected, 'selected-option': false }"
					@click="select(option)")
					.option-inner
						slot(
							:name="getOptionSlotName(context)"
							v-bind="bindOption(option)")
							slot(v-bind="bindOption(option)") {{ getLabel(option) }}
		.loading-overlay(v-if="context.state.loading")
			slot(name="loading-icon" v-bind="bnd")
</template>

<script>
	import utilMixin from "../util-mixin";

	export default {
		name: "Options",
		mixins: [utilMixin],
		methods: {
			select(option) {
				option.select();
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
					selected: option.selected
				});
			},
			emitTrigger(option) {
				this.$emit("trigger", option);
			},
			getOptionSlotName(context) {
				return `${context.config.name}-option`;
			}
		},
		props: {
			input: null,
			context: null,
			depth: {
				type: Number,
				default: 0
			}
		}
	};
</script>
