<template lang="pug">
	Drop.input-wrapper.date.inp-date(
		:class="validationState"
		@key="key"
		@collapse="collapse")
		template(#expando-box="rt")
			.date-display
		DateSelector(
			:input="input")
		//- TimeSelector(
			:input="input"
			@displaydatachange="dd => timeDisplayData = Object.assign({}, dd)"
			@trigger="trigger")
</template>

<script>
	import {
		numLen,
		repeat,
		padStart
	} from "@qtxr/utils";
	import EVT from "@qtxr/evt";
	import Form, { Date as DateInput } from "@qtxr/form";

	import Drop from "../auxiliary/drop.vue";
	import DateSelector from "../core-inputs/date-selector.vue";

	export default {
		name: "Date",
		data: _ => ({
			dateDisplayData: {},
			validationMsg: null,
			validationState: "ok"
		}),
		methods: {
			trigger() {
				if (this.disabled)
					return;
			},
			collapse(evt) {
				// this.timeDisplayData.resetIndices();
			},
			key(evt, key, runtime) {
				switch (key) {
					case "enter":
						runtime.collapse();
						evt.preventDefault();
						break;

					case "left":
						this.dateDisplayData.setActiveIdx(-1);
						evt.preventDefault();
						break;

					case "right":
						this.dateDisplayData.setActiveIdx(1);
						evt.preventDefault();
						break;
				}
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
			input: DateInput,
			disabled: Boolean,
			mobileQuery: String,
			meta: {
				type: Object,
				default: _ => ({})
			}
		},
		components: {
			Drop,
			DateSelector
		},
		beforeMount() {
			this.input.hook("update", inp => {
				this.validationState = inp.validationState;
				this.validationMsg = inp.validationMsg || this.validationMsg;
			});
		}
	};
</script>
