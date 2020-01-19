<template lang="pug">
	Drop.input-wrapper.time.inp-time(
		:class="validationState"
		@collapse="collapse"
		@key="key")
		template(#expando-box="rt")
			.time-display
				template(v-for="(runtime, i) in timeDisplayData.dialsData")
					.range-sep(v-if="i > 0") {{ typeof input.rangeSeparator == "string" ? input.rangeSeparator : "-" }}
					.time-display-item
						template(v-for="(dial, j) in runtime.dials")
							span.time-sep(v-if="j > 0") {{ typeof input.timeSeparator == "string" ? input.timeSeparator : ":" }}
							span.time-display-cell(:class="[ dial.class, (rt.expanded && timeDisplayData.activeIndices[i] == j) ? 'active' : null ]") {{ dial.displayVal }}
						span.meridiem(v-if="input.meridiem && runtime.meridiem") {{ runtime.meridiem }}
		TimeSelector(
			:input="input"
			@displaydatachange="dd => timeDisplayData = Object.assign({}, dd)"
			@trigger="trigger")
</template>

<script>
	import { get } from "@qtxr/utils";
	import EVT from "@qtxr/evt";
	import { Time } from "@qtxr/form";
	import mixin from "../mixin";

	import Drop from "../auxiliary/drop.vue";
	import TimeSelector from "../core-inputs/time-selector.vue";

	export default {
		name: "Time",
		mixins: [mixin],
		data: _ => ({
			timeDisplayData: {}
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

					return timeData;
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
				this.timeDisplayData.resetDisplay();
			},
			key(evt, key, runtime) {
				switch (key) {
					case "enter":
						runtime.collapse();
						evt.preventDefault();
						break;

					case "left":
						this.timeDisplayData.setActiveIdx(-1);
						evt.preventDefault();
						break;

					case "right":
						this.timeDisplayData.setActiveIdx(1);
						evt.preventDefault();
						break;
				}
			}
		},
		props: {
			input: Time
		},
		components: {
			Drop,
			TimeSelector
		}
	};
</script>
