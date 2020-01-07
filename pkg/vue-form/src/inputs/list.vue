<template lang="pug">
	.input-wrapper.list.inp-list(:class="[ validationState , focusIdx == -1 ? null : 'has-focus']")
		.list-row-add(@click="add(0, true)")
			.list-add-click-target
			.list-row-add-icon
		template(v-for="(form, idx) in input.value")
			.list-inp-row-wrapper(
				:class="{ focused: idx == focusIdx }"
				:key="form.id")
				.list-inp-focus
				.list-inp-row
					slot(
						name="form"
						v-bind="getSlotData(form)")
					.row-actions-runner
						.row-actions
							slot(
								name="actions-pre"
								v-bind="getSlotData(form)")
							button.row-action.delete(@click="remove(idx)")
								slot(
									name="delete-icon"
									v-bind="getSlotData(form)")
									template(v-if="symbols.delete") {{ res(symbols.delete) }}
									.row-action-symbol.default-row-action-icon.delete(v-else)
							button.row-action.move.up(
								v-if="idx > 0"
								@click="moveUp(idx)")
								slot(
									name="up-icon"
									v-bind="getSlotData(form)")
									template(v-if="symbols.up") {{ res(symbols.up) }}
									.row-action-symbol.default-row-action-icon.up(v-else)
							button.row-action.move.down(
								v-if="idx < input.value.length - 1"
								@click="moveDown(idx)")
								slot(
									name="down-icon"
									v-bind="getSlotData(form)")
									template(v-if="symbols.down") {{ res(symbols.down) }}
									.row-action-symbol.default-row-action-icon.down(v-else)
							slot(
								name="actions-post"
								v-bind="getSlotData(form)")
			.list-row-add(@click="add(idx + 1, false)")
				.list-add-click-target
				.list-row-add-icon
</template>

<script>
	import { requestFrame } from "@qtxr/utils";
	import { List } from "@qtxr/form";
	import mixin from "../mixin";

	import VForm from "../v-form.vue";

	const timeoutDuration = 1000;

	export default {
		name: "List",
		mixins: [mixin],
		data: _ => ({
			focusIdx: -1,
			focusTimeout: null
		}),
		methods: {
			trigger() {
				if (!this.disabled)
					this.input.trigger(this.input.value);
			},
			add(idx, prefixed) {
				const row = this.input.getRow();
					
				if (typeof this.input.beforeadd != "function" || this.input.beforeadd(row, idx) !== false) {
					this.input.value.splice(idx, 0, row);
					this.setFocus(idx);
					this.trigger();
				}
			},
			remove(idx) {
				if (typeof this.input.beforeremove != "function" || this.input.beforeremove(this.input.value[idx], idx) !== false) {
					this.input.value.splice(idx, 1);
					this.trigger();
				}
			},
			moveUp(idx) {
				const val = this.input.value;

				if (typeof this.input.beforemove != "function" || this.input.beforemove(val[idx], "up", idx) !== false) {
					val.splice(idx - 1, 0, val.splice(idx, 1)[0]);
					this.setFocus(idx - 1);
					this.trigger();
				}
			},
			moveDown(idx) {
				const val = this.input.value;

				if (typeof this.input.beforemove != "function" || this.input.beforemove(val[idx], "down", idx) !== false) {
					val.splice(idx + 1, 0, val.splice(idx, 1)[0]);
					this.setFocus(idx + 1);
					this.trigger();
				}
			},
			setFocus(idx) {
				requestFrame(_ => this.focusIdx = idx);
				clearTimeout(this.focusTimeout);
				this.focusTimeout = setTimeout(_ => this.focusIdx = -1, timeoutDuration);
			},
			getSlotData(form) {
				return {
					form,
					rows: form.inputsStruct
				};
			}
		},
		props: {
			input: List,
			symbols: {
				type: Object,
				default: _ => ({})
			}
		},
		components: {
			VForm
		}
	}
</script>
