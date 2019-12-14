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
					.row-content
						slot(
							name="form"
							v-bind="{ form, rows: form.inputsStruct }")
					.row-actions-runner
						.row-actions
							button.row-action.delete(@click="remove(idx)")
								slot(name="delete-symbol")
								template(v-if="symbols.delete") {{ res(symbols.delete) }}
								.default-row-action-symbol.delete(v-else)
							button.row-action.move.up(
								v-if="idx > 0"
								@click="moveUp(idx)")
								slot(name="up-symbol")
								template(v-if="symbols.up") {{ res(symbols.up) }}
								.default-row-action-symbol.up(v-else)
							button.row-action.move.down(
								v-if="idx < input.value.length - 1"
								@click="moveDown(idx)")
								slot(name="down-symbol")
								template(v-if="symbols.down") {{ res(symbols.down) }}
								.default-row-action-symbol.down(v-else)
			.list-row-add(@click="add(idx, false)")
				.list-add-click-target
				.list-row-add-icon
</template>

<script>
	import { requestFrame } from "@qtxr/utils";
	import Form, { List } from "@qtxr/form";

	import VForm from "../v-form.vue";

	const timeoutDuration = 1000;

	export default {
		name: "List",
		data: _ => ({
			focusIdx: -1,
			focusTimeout: null,
			validationMsg: null,
			validationState: "ok"
		}),
		methods: {
			trigger() {
				if (!this.disabled)
					this.input.trigger(this.input.value);
			},
			add(idx, prefixed) {
				const row = this.input.getRow();
				this.input.value.splice(idx, 0, row);
				this.setFocus(prefixed ? idx : idx + 1);
				this.trigger();
			},
			remove(idx) {
				this.input.value.splice(idx, 1);
				this.trigger();
			},
			moveUp(idx) {
				const val = this.input.value;
				val.splice(idx - 1, 0, val.splice(idx, 1)[0]);
				this.setFocus(idx - 1);
				this.trigger();
			},
			moveDown(idx) {
				const val = this.input.value;
				val.splice(idx + 1, 0, val.splice(idx, 1)[0]);
				this.setFocus(idx + 1);
				this.trigger();
			},
			setFocus(idx) {
				requestFrame(_ => this.focusIdx = idx);
				clearTimeout(this.focusTimeout);
				this.focusTimeout = setTimeout(_ => this.focusIdx = -1, timeoutDuration);
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
			input: List,
			disabled: Boolean,
			symbols: {
				type: Object,
				default: _ => ({})
			},
			mobileQuery: String,
			meta: {
				type: Object,
				default: _ => ({})
			}
		},
		components: {
			VForm
		},
		beforeMount() {
			this.input.hook("update", inp => {
				this.validationState = inp.validationState;
				this.validationMsg = inp.validationMsg || this.validationMsg;
			});
		}
	}
</script>
