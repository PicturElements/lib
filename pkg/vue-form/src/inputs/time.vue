<template lang="pug">
	Drop.input-wrapper.time.inp-time(
		:class="validationState"
		@key="key"
		@collapse="collapse")
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
	import {
		numLen,
		repeat,
		padStart
	} from "@qtxr/utils";
	import EVT from "@qtxr/evt";
	import Form, { Time } from "@qtxr/form";

	import Drop from "../auxiliary/drop.vue";
	import TimeSelector from "../core-inputs/time-selector.vue";

	export default {
		name: "Time",
		data: _ => ({
			timeDisplayData: {},
			validationMsg: null,
			validationState: "ok"
		}),
		methods: {
			trigger() {
				const reduce = dials => {
					let timestamp = 0;

					for (let i = 0, l = dials.length; i < l; i++) {
						const dialData = dials[i],
							multiplier = this.res(dialData.dial.multiplier) || 1;

						timestamp += (dialData.value || 0) * multiplier;
					}

					return timestamp;
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
				this.timeDisplayData.resetIndices();
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
			input: Time,
			mobileQuery: String,
			meta: {
				type: Object,
				default: _ => ({})
			}
		},
		components: {
			Drop,
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
