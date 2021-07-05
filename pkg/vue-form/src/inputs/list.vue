<template lang="pug">
	.input-wrapper.list.inp-list(
		:class="cl({ 'has-focus': focusIdx > -1 })"
		:aria-invalid="err")
		button.list-row-add(
			:disabled="addIsDisabled(0)"
			type="button"
			@click="add(0)")
			.list-add-click-target
			.list-row-add-icon
		template(
			v-for="(form, idx) in input.value"
			:key="form.id")
			.list-inp-row-wrapper(:class="{ focused: idx == focusIdx }")
				.list-inp-focus
				.list-inp-row
					slot(
						name="form"
						v-bind="bindForm(form)")
					.row-actions-runner
						.row-actions
							slot(
								name="actions-pre"
								v-bind="bindForm(form)")
							button.row-action.delete(
								type="button"
								@click="remove(idx)")
								slot(
									name="delete-icon"
									v-bind="bindForm(form)")
									template(v-if="symbols.delete") {{ res(symbols.delete) }}
									.row-action-symbol.default-row-action-icon.delete(v-else)
							button.row-action.move.up(
								v-if="res(input.rearrangeable) !== false && idx > 0"
								type="button"
								@click="moveUp(idx)")
								slot(
									name="up-icon"
									v-bind="bindForm(form)")
									template(v-if="symbols.up") {{ res(symbols.up) }}
									.row-action-symbol.default-row-action-icon.up(v-else)
							button.row-action.move.down(
								v-if="res(input.rearrangeable) !== false && idx < input.value.length - 1"
								type="button"
								@click="moveDown(idx)")
								slot(
									name="down-icon"
									v-bind="bindForm(form)")
									template(v-if="symbols.down") {{ res(symbols.down) }}
									.row-action-symbol.default-row-action-icon.down(v-else)
							slot(
								name="actions-post"
								v-bind="bindForm(form)")
			button.list-row-add(
				:disabled="addIsDisabled(idx + 1)"
				type="button"
				@click="add(idx + 1)")
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
				if (!this.inert)
					this.input.trigger(this.input.value);
			},
			add(idx) {
				if (this.addIsDisabled(idx))
					return;

				const row = this.input.getRow();

				if (typeof this.input.beforeadd != "function" || this.res(this.input.beforeadd, row, idx) !== false) {
					this.input.value.splice(idx, 0, row);
					this.setFocus(idx);
					this.trigger();
				}
			},
			remove(idx) {
				if (typeof this.input.beforeremove != "function" || this.res(this.input.beforeremove, this.input.value[idx], idx) !== false) {
					this.input.value.splice(idx, 1);
					this.trigger();
				}
			},
			moveUp(idx) {
				const val = this.input.value;

				if (typeof this.input.beforemove != "function" || this.res(this.input.beforemove, val[idx], "up", idx) !== false) {
					val.splice(idx - 1, 0, val.splice(idx, 1)[0]);
					this.setFocus(idx - 1);
					this.trigger();
				}
			},
			moveDown(idx) {
				const val = this.input.value;

				if (typeof this.input.beforemove != "function" || this.res(this.input.beforemove, val[idx], "down", idx) !== false) {
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
			bindForm(form) {
				return this.bind({
					form,
					rows: form.inputsStruct
				});
			},
			addIsDisabled(idx) {
				if (this.dis)
					return true;

				if (this.res(this.input.backwardEditable) !== false)
					return false;

				return idx != this.input.value.length;
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
