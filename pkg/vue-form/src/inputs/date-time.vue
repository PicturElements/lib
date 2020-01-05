<template lang="pug">
	Drop.input-wrapper.date-time.inp-date-time(
		:class="[ isMobile() ? 'mobi' : null, validationState ]"
		@collapse="collapse")
		template(#expando-box="rt")
			.date-time-display
				template(v-for="(runtime, i) in dateDisplayData.cardsData")
					.range-sep(v-if="i > 0") {{ typeof input.rangeSeparator == "string" ? input.rangeSeparator : "-" }}
					.date-display-item
						template(v-for="(card, j) in runtime.cards")
							span.date-sep(v-if="j > 0")
							span.date-display-cell(:class="card.class") {{ card.displayVal }}
				span.date-time-sep
				template(v-for="(runtime, i) in timeDisplayData.dialsData")
					.range-sep(v-if="i > 0") {{ typeof input.rangeSeparator == "string" ? input.rangeSeparator : "-" }}
					.time-display-item
						template(v-for="(dial, j) in runtime.dials")
							span.time-sep(v-if="j > 0") {{ typeof input.timeSeparator == "string" ? input.timeSeparator : ":" }}
							span.time-display-cell(:class="[ dial.class, (rt.expanded && timeDisplayData.activeIndices[i] == j) ? 'active' : null ]") {{ dial.displayVal }}
						span.meridiem(v-if="input.meridiem && runtime.meridiem") {{ runtime.meridiem }}
		DateSelector(
			:input="input"
			@displaydatachange="dd => dateDisplayData = Object.assign({}, dd)"
			@trigger="trigger")
		TimeSelector.time-sel(
			:input="input"
			@displaydatachange="dd => timeDisplayData = Object.assign({}, dd)"
			@trigger="trigger")
</template>

<script>
	import { get } from "@qtxr/utils";
	import EVT from "@qtxr/evt";
	import { DateTime } from "@qtxr/form";

	import Drop from "../auxiliary/drop.vue";
	import DateSelector from "../core-inputs/date-selector.vue";
	import TimeSelector from "../core-inputs/time-selector.vue";

	export default {
		name: "DateTime",
		data: _ => ({
			timeDisplayData: {},
			dateDisplayData: {},
			validationMsg: null,
			validationState: "ok"
		}),
		methods: {
			trigger() {
				if (this.disabled)
					return;
				
				const reduce = dials => {
					const timeData = {};
					
					for (let i = 0, l = dials.length; i < l; i++) {
						const dialData = dials[i],
							gotten = get(timeData, dialData.dial.accessor, null, "autoBuild|context");

						gotten.context[gotten.key] = dialData.value;
					}

					return Object.assign({}, this.input.value, timeData);
				};

				const dialsData = this.timeDisplayData.dialsData;

				if (this.input.range) {
					const value = [];

					for (let i = 0, l = dialsData.length; i < l; i++)
						value.push(reduce(dialsData[i].dials));

					this.input.trigger(value);
				} else
					this.input.trigger(reduce(dialsData[0].dials));
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
			input: DateTime,
			disabled: Boolean,
			mobileQuery: String,
			meta: {
				type: Object,
				default: _ => ({})
			}
		},
		components: {
			Drop,
			DateSelector,
			TimeSelector
		},
		beforeMount() {
			this.input.hook("update", inp => {
				this.validationState = inp.validationState;
				this.validationMsg = inp.validationMsg || this.validationMsg;
			});
		}
	};
</script>
