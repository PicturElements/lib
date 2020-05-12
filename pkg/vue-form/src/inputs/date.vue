<template lang="pug">
	Drop.input-wrapper.date.inp-date(
		v-bind="propPassthrough"
		:class="classes"
		:adaptive="true"
		:scrollTargets="['.year-scroll', { node: '.drop-dropdown-scroll', tolerance: 10 }]"
		@collapse="collapse"
		@key="key")
		template(#expando-box="rt")
			.date-display
				template(v-for="(runtime, i) in dateDisplayData.cardsData")
					.range-sep(v-if="i > 0") {{ typeof input.rangeSeparator == "string" ? input.rangeSeparator : "-" }}
					.date-display-item
						template(v-for="(card, j) in runtime.cards")
							span.date-sep(v-if="j > 0")
							span.date-display-cell(:class="card.class") {{ card.displayVal }}
		template(#default="rt")
			DateSelector(
				:input="input"
				:dropRuntime="rt"
				:eagerCollapse="res(eagerCollapse)"
				@displaydatachange="dd => dateDisplayData = dd"
				@trigger="trigger")
</template>

<script>
	import { set } from "@qtxr/utils";
	import EVT from "@qtxr/evt";
	import { Date as DateInput } from "@qtxr/form";
	import mixin from "../mixin";

	import Drop from "../core/drop.vue";
	import DateSelector from "../core/date-selector.vue";

	export default {
		name: "Date",
		mixins: [mixin],
		data: _ => ({
			dateDisplayData: {}
		}),
		methods: {
			trigger(value) {
				if (this.inert)
					return;
				
				const reduce = cardsData => {
					const dateData = {};
					
					for (let i = 0, l = cardsData.cards.length; i < l; i++) {
						const cardData = cardsData.cards[i];
						set(dateData, cardData.card.accessor, cardData.value);
					}

					return Object.assign(
						{},
						this.input.value,
						dateData,
						cardsData.set
					);
				};

				const cardsData = this.dateDisplayData.cardsData;

				if (this.input.range) {
					const value = [];

					for (let i = 0, l = cardsData.length; i < l; i++)
						value.push(reduce(cardsData[i]));

					this.input.trigger(value);
				} else
					this.input.trigger(reduce(cardsData[0]));
			},
			collapse(evt) {
				this.dateDisplayData.resetDisplay();
			},
			key(evt, key, runtime) {
				switch (key) {
					case "enter":
						if (runtime.hasNeutralTarget()) {
							runtime.collapse();
							evt.preventDefault();
						}
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
			input: DateInput,
			eagerCollapse: [Boolean, Function]
		},
		components: {
			Drop,
			DateSelector
		}
	};
</script>
