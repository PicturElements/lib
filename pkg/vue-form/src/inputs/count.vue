<template lang="pug">
	.input-wrapper.count.inp-count(:class="{ compact: input.compact }")
		template(v-if="input.compact")
			input(
				type="tel"
				:key="key"
				:value="input.value"
				:disabled="disabled"
				@keydown="keydown"
				@change="change")
			.vertical-count-buttons
				button.count-btn.up(
					tabindex="-1"
					:disabled="disabled"
					@click="up")
					slot(name="up-symbol")
						template(v-if="symbols.up") {{ res(symbols.up) }}
						.default-count-symbol.up(v-else)
				.count-btn-sep
				button.count-btn.down(
					tabindex="-1"
					:disabled="disabled"
					@click="down")
					slot(name="down-symbol")
						template(v-if="symbols.down") {{ res(symbols.down) }}
						.default-count-symbol.down(v-else)
		template(v-else)
			button.count-btn.down(
				tabindex="-1"
				:disabled="disabled"
				@click="down")
				slot(name="down-symbol") {{ res(symbols.down) || "-" }}
			input(
				type="tel"
				:key="key"
				:value="input.value"
				:disabled="disabled"
				@keydown="keydown"
				@change="change")
			button.count-btn.up(
				tabindex="-1"
				:disabled="disabled"
				@click="up")
				slot(name="up-symbol") {{ res(symbols.up) || "+" }}
</template>

<script>
	import {
		round,
		findClosest
	} from "@qtxr/utils";
	import { Count } from "@qtxr/form";
	import EVT from "@qtxr/evt";

	export default {
		name: "Count",
		data: _ => ({
			key: 0
		}),
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
					this.fitCount(round(this.input.value + (this.input.step || 1), 8));
			},
			down() {
				const ticks = this.input.ticks;

				if (Array.isArray(ticks)) {
					const result = findClosest(ticks, this.input.value, "lower"),
						idx = Math.max(result.exact ? result.index - 1 : result.index, 0);

					this.fitCount(ticks[idx]);
				} else
					this.fitCount(round(this.input.value - (this.input.step || 1), 8));
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
				let min = this.input.min,
					max = this.input.max;

				if (Array.isArray(this.input.ticks)) {
					min = this.input.ticks[0];
					max = this.input.ticks[this.input.ticks.length - 1];
				}

				min = typeof min == "number" ? (min || 0) : -Infinity;
				max = typeof max == "number" ? (max || 0) : Infinity;
				let newCount = Math.min(Math.max(count, min || 0), max);

				if (isNaN(newCount))
					newCount = min;

				if (!this.disabled)
					this.input.trigger(newCount);

				this.key++;
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
			input: Count,
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
		mounted() {
			this.fitCount(this.input.value);
		}
	}
</script>
