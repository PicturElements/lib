<template lang="pug">
	Drop.input-wrapper.date.inp-date(
		:class="validationState"
		@collapse="collapse")
		template(#expando-box="rt")
			.date-display
				template(v-for="(runtime, i) in dateDisplayData.cardsData")
					.range-sep(v-if="i > 0") {{ typeof input.rangeSeparator == "string" ? input.rangeSeparator : "-" }}
					.date-display-item
						template(v-for="(card, j) in runtime.cards")
							span.date-sep(v-if="j > 0")
							span.date-display-cell(:class="card.class") {{ card.displayVal }}
		DateSelector(
			:input="input"
			@displaydatachange="dd => dateDisplayData = Object.assign({}, dd)"
			@trigger="trigger")
</template>

<script>
	import EVT from "@qtxr/evt";
	import { Date as DateInput } from "@qtxr/form";

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
				this.dateDisplayData.resetDisplay();
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
