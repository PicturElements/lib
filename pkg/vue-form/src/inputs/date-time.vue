<template lang="pug">
	Drop.input-wrapper.date-time.inp-date-time(
		:class="classes"
		:disabled="dis"
		:adaptive="true"
		@collapse="collapse"
		@key="key")
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
			@displaydatachange="dd => dateDisplayData = dd"
			@trigger="trigger")
		TimeSelector.time-sel(
			:input="input"
			@displaydatachange="dd => timeDisplayData = dd"
			@trigger="trigger")
</template>

<script>
	import { set } from "@qtxr/utils";
	import EVT from "@qtxr/evt";
	import { DateTime } from "@qtxr/form";
	import mixin from "../mixin";

	import Drop from "../core/drop.vue";
	import DateSelector from "../core/date-selector.vue";
	import TimeSelector from "../core/time-selector.vue";

	export default {
		name: "DateTime",
		mixins: [mixin],
		data: _ => ({
			timeDisplayData: {},
			dateDisplayData: {}
		}),
		methods: {
			trigger() {
				if (this.inert)
					return;
				
				const reduce = (cardsData, dialsData) => {
					const dateTimeData = {};
					
					for (let i = 0, l = cardsData.cards.length; i < l; i++) {
						const cardData = cardsData.cards[i];
						set(dateTimeData, cardData.card.accessor, cardData.value);
					}

					for (let i = 0, l = dialsData.dials.length; i < l; i++) {
						const dialData = dialsData.dials[i];
						set(dateTimeData, dialData.dial.accessor, dialData.value);
					}

					return Object.assign(
						{},
						this.input.value,
						dateTimeData,
						cardsData.set
					);
				};

				const cardsData = this.dateDisplayData.cardsData,
					dialsData = this.timeDisplayData.dialsData;

				if (this.input.range) {
					const value = [];

					for (let i = 0, l = cardsData.length; i < l; i++)
						value.push(reduce(cardsData[i], dialsData[i]));

					this.input.trigger(value);
				} else
					this.input.trigger(reduce(cardsData[0], dialsData[0]));
			},
			collapse(evt) {
				this.dateDisplayData.resetDisplay();
				this.timeDisplayData.resetDisplay();
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
			}
		},
		props: {
			input: DateTime
		},
		components: {
			Drop,
			DateSelector,
			TimeSelector
		}
	};
</script>
