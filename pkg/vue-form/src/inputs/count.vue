<template lang="pug">
	.input-wrapper.count.inp-count
		button.count-btn.down(
			tabindex="-1"
			@click="down")
			slot(name="down-symbol") {{ res(symbols.down) || "-" }}
		input(
			type="tel" 
			:value="input.value"
			@keydown="keydown"
			@change="change")
		button.count-btn.up(
			tabindex="-1"
			@click="up")
			slot(name="up-symbol") {{ res(symbols.up) || "+" }}
</template>

<script>
	import Form, { Count } from "@qtxr/form";
	import EVT from "@qtxr/evt";

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
				const min = typeof this.input.min == "number" ? (this.input.min || 0) : -Infinity,
					max = typeof this.input.max == "number" ? (this.input.max || 0) : Infinity;
				let newCount = Math.min(Math.max(count, min || 0), max);

				if (isNaN(newCount))
					newCount = min;

				this.input.trigger(newCount);
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
