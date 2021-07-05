<template lang="pug">
	.input-wrapper.count.inp-count(:class="cl({ compact: res(input.compact) })")
		template(v-if="res(compact)")
			input(
				v-bind="inpPropsFull"
				:value="input.value"
				:aria-invalid="err"
				:inputmode="inputmode"
				type="tel"
				@keydown="keydown"
				@change="change")
			.vertical-count-buttons
				button.count-btn.up(
					:disabled="inert"
					tabindex="-1"
					type="button"
					@click="up")
					slot(name="up-symbol")
						template(v-if="symbols.up") {{ res(symbols.up) }}
						.default-count-symbol.up(v-else)
				.count-btn-sep
				button.count-btn.down(
					:disabled="inert"
					tabindex="-1"
					type="button"
					@click="down")
					slot(name="down-symbol")
						template(v-if="symbols.down") {{ res(symbols.down) }}
						.default-count-symbol.down(v-else)
		template(v-else)
			button.count-btn.down(
				:disabled="inert"
				tabindex="-1"
				type="button"
				@click="down")
				slot(name="down-symbol") {{ res(symbols.down) || "-" }}
			input(
				v-bind="inpPropsFull"
				:value="input.value"
				:aria-invalid="err"
				:inputmode="inputmode"
				type="tel"
				@keydown="keydown"
				@change="change")
			button.count-btn.up(
				:disabled="inert"
				tabindex="-1"
				type="button"
				@click="up")
				slot(name="up-symbol") {{ res(symbols.up) || "+" }}
		ValidationMsg(
			:input="input"
			:msg="validationMsg")
</template>

<script>
	import {
		round,
		findClosest
	} from "@qtxr/utils";
	import { Count } from "@qtxr/form";
	import EVT from "@qtxr/evt";
	import ValidationMsg from "../core/validation-msg.vue";
	import mixin from "../mixin";

	export default {
		name: "Count",
		mixins: [mixin],
		methods: {
			up() {
				const ticks = this.input.ticks;

				if (Array.isArray(ticks)) {
					const result = findClosest(ticks, this.input.value, "upper"),
						idx = result.exact ? result.index + 1 : result.index;

					if (idx == -1 || idx == ticks.length)
						this.fitCount(ticks[ticks.length - 1]);
					else
						this.fitCount(ticks[idx]);
				} else
					this.fitCount(round(this.input.value + (this.res(this.input.step) || 1), 8));
			},
			down() {
				const ticks = this.input.ticks;

				if (Array.isArray(ticks)) {
					const result = findClosest(ticks, this.input.value, "lower"),
						idx = Math.max(result.exact ? result.index - 1 : result.index, 0);

					this.fitCount(ticks[idx]);
				} else
					this.fitCount(round(this.input.value - (this.res(this.input.step) || 1), 8));
			},
			change(evt) {
				this.fitCount(Number(evt.target.value) || 0);
			},
			keydown(evt) {
				switch (EVT.getKey(evt)) {
					case "up":
						this.up();
						evt.preventDefault();
						break;

					case "down":
						this.down();
						evt.preventDefault();
						break;
				}

				this.input.check(evt, evt.target.value);
			},
			fitCount(count) {
				const ticks = this.res(this.input.ticks, count);
				let min = this.input.min,
					max = this.input.max;

				if (Array.isArray(ticks)) {
					min = ticks[0];
					max = ticks[ticks.length - 1];
				}

				min = typeof min == "number" ? (min || 0) : -Infinity;
				max = typeof max == "number" ? (max || 0) : Infinity;
				let newCount = Math.min(Math.max(count, min || 0), max);

				if (isNaN(newCount))
					newCount = min;

				if (!this.inert)
					this.input.trigger(newCount);
			}
		},
		computed: {
			inputmode() {
				const step = this.res(this.input.step) || 1,
					ticks = this.res(this.input.ticks, 0);

				if (Array.isArray(ticks)) {
					// Don't mess around with huge arrays and return
					// the safest and most universal option
					if (ticks.length > 100)
						return "decimal";

					for (let i = 0, l = ticks.length; i < l; i++) {
						if (ticks[i] % 1 != 0)
							return "decimal";
					}

					return "numeric";
				}

				return step % 1 == 0 ?
					"numeric" :
					"decimal";
			}
		},
		props: {
			input: Count,
			symbols: {
				type: Object,
				default: _ => ({})
			},
			compact: [Boolean, Function]
		},
		components: {
			ValidationMsg
		},
		mounted() {
			this.fitCount(this.input.value);
		}
	}
</script>
