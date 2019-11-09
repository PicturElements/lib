<template lang="pug">
	.input-wrapper.time.inp-time(:class="validationState")
		button.time-display.f.c
			template(v-for="(display, idx) in getDisplayData()")
				.range-sep(v-if="idx % 2") {{ display }}
				.time-display-item.f.c(v-else)
					span.hours {{ display.hours }}
					span.time-sep :
					span.minutes {{ display.minutes }}
					span.meridiem(v-if="input.meridiem") {{ display.meridiem }}
		.time-modal(v-if="expanded")
</template>

<script>
	import { padStart } from "@qtxr/utils";
	import Form, { Time } from "@qtxr/form";

	export default {
		name: "Time",
		data: _ => ({
			expanded: false,
			validationMsg: null,
			validationState: "ok"
		}),
		methods: {
			trigger(evt) {
				Form.trigger(this.input, evt.target.value);
			},
			check(evt) {
				Form.check(this.input, evt, evt.target.value);
			},
			resolveDate() {
				const dateOrTimestamp = this.input.value;

				if (dateOrTimestamp instanceof Date)
					return dateOrTimestamp;

				return new Date(dateOrTimestamp);
			},
			getDisplayData() {
				if (this.input.range) {
					return [
						this.getTimeDisplayData(
							this.resolveDate(this.input.value[0])
						),
						this.rangeSeparator,
						this.getTimeDisplayData(
							this.resolveDate(this.input.value[1])
						)
					];
				}

				return [
					this.getTimeDisplayData(
						this.resolveDate(this.input.value)
					)
				]
			},
			getTimeDisplayData(date) {
				return {
					hours: this.getHours(date),
					minutes: this.getMinutes(date),
					meridiem: this.getMeridiem(date)
				};
			},
			getHours(date) {
				const hours = date.getHours() || 0;

				if (this.input.meridiem)
					return String(hours % 12 || 12);

				return padStart(hours, 2, "0");
			},
			getMinutes(date) {
				if (this.input.meridiem)
					return String(date.getMinutes() || 0);

				return padStart(date.getMinutes() || 0, 2, "0");
			},
			getMeridiem(date) {
				const hours = date.getHours() || 0;
				return this.ampmLabels[Math.floor(hours / 12)];
			},
			res(val) {
				if (typeof val == "function")
					return val.call(this.input);

				return val;
			},
			isMobile() {
				const mobileQuery = this.mobileQuery || this.meta.mobileQuery || "(max-aspect-ratio: 1/1) and (max-width: 700px)";
				return matchMedia(mobileQuery).matches;
			}
		},
		props: {
			input: Time,
			placeholder: String,
			mobileQuery: String,
			ampmLabels: {
				type: Array,
				default: _ => ["AM", "PM"]
			},
			rangeSeparator: {
				type: String,
				default: "-"
			},
			meta: {
				type: Object,
				default: _ => ({})
			}
		},
		beforeMount() {
			this.input.hook("update", inp => {
				this.validationState = inp.validationState;
				this.validationMsg = inp.validationMsg || this.validationMsg;
			});
		}
	}
</script>
