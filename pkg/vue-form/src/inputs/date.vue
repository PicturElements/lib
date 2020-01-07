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
	import mixin from "../mixin";

	import Drop from "../auxiliary/drop.vue";
	import DateSelector from "../core-inputs/date-selector.vue";

	export default {
		name: "Date",
		mixins: [mixin],
		data: _ => ({
			dateDisplayData: {}
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
			}
		},
		props: {
			input: DateInput
		},
		components: {
			Drop,
			DateSelector
		}
	};
</script>
