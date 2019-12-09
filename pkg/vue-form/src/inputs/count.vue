<template lang="pug">
	.input-wrapper.count.inp-count
		button.count-btn.down(@click="down")
			slot(name="down-symbol") {{ res(symbols.down) || "-" }}
		input(
			type="tel" 
			:value="input.value"
			@keydown="check"
			@change="change")
		button.count-btn.up(@click="up")
			slot(name="up-symbol") {{ res(symbols.up) || "+" }}
</template>

<script>
	import Form, { Count } from "@qtxr/form";

	export default {
		name: "Count",
		methods: {
			up() {
				const step = this.input.step || 1;
				this.fitCount(this.input.value + step);
			},
			down() {
				const step = this.input.step || 1;
				this.fitCount(this.input.value - step);
			},
			change(evt) {
				this.fitCount(Number(evt.target.value) || 0);
			},
			fitCount(count) {
				const min = typeof this.input.min == "number" ? (this.input.min || 0) : -Infinity,
					max = typeof this.input.max == "number" ? (this.input.max || 0) : Infinity;
				let newCount = Math.min(Math.max(count, min || 0), max);

				if (isNaN(newCount))
					newCount = min;

				this.input.trigger(newCount);
			},
			check(evt) {
				this.input.check(evt, evt.target.value);
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
