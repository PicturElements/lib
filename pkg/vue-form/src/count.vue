<template lang="pug">
	.input-wrapper.count.inp-count
		button.count-btn.down(@click="down")
			slot(name="down-symbol") {{ res(symbols.down) || "-" }}
		input.f-grow(
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
				this.fitCount(this.input.value + 1);
			},
			down() {
				this.fitCount(this.input.value - 1);
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

				Form.trigger(this.input, newCount);
			},
			check(evt) {
				Form.check(this.input, evt, evt.target.value);
			},
			res(val) {
				if (typeof val == "function")
					return val.call(this, this.form, this.input);

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
			this.fitCount(this.$props.count);
		}
	}
</script>
