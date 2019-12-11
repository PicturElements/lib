<template lang="pug">
	.dials-wrapper-wrapper
		template(v-for="(d, i) in dialsData")
			Dials(
				:updates="updates"
				:input="input"
				:dials="d.dials"
				:activeIdx="activeIndices[i]"
				@select="payload => select(payload, i)"
				@focus="activeDialsIdx = i"
				@change="change(i)")
</template>

<script>
	import {
		numLen,
		repeat,
		padStart
	} from "@qtxr/utils";
	import EVT from "@qtxr/evt";
	import Form, { Time } from "@qtxr/form";

	import Dials from "./dials.vue";

	export default {
		name: "TimeSelector",
		data: _ => ({
			updates: 0,
			dialsData: [],
			activeIndices: [],
			activeDialsIdx: 0
		}),
		methods: {
			updateDialsData(mergeIndices) {
				const getTimeDisplayItem = timestamp => {
					const runtime = {
							meridiem: null,
							dials: []
						},
						dials = this.input.dials;

					for (let i = 0, l = dials.length; i < l; i++) {
						const dial = dials[i],
							dialData = this.mkDialData(dial, runtime);

						this.setDialValue(dialData, timestamp == null ?
							null :
							this.getValueFromTimestamp(dial, timestamp)
						);

						runtime.dials.push(dialData);
					}

					return runtime;
				};

				if (this.input.range) {
					const out = [],
						indices = [];

					for (let i = 0, l = this.input.value.length; i < l; i++) {
						out.push(getTimeDisplayItem(this.input.value[i].data));
						indices.push(mergeIndices ? this.activeIndices[i] || 0 : 0);
					}

					this.dialsData = out;
					this.activeIndices = indices;
				} else {
					this.dialsData = [
						getTimeDisplayItem(this.input.value.data)
					];
					this.activeIndices = mergeIndices ? this.activeIndices : [0];
				}

				this.emitDisplayData();
			},
			mkDialData(dial, runtime) {
				const dialData = {
					dial,
					class: dial.name ? `time-display-cell-${dial.name}` : null,
					value: null,
					displayVal: "",
					runtime
				};

				dialData.setValue = value => {
					this.setDialValue(dialData, value);
				};

				return dialData;
			},
			setDialValue(dialData, value) {
				const dial = dialData.dial;

				if (value == null) {
					const placeholderChar = typeof this.input.placeholderChar == "string" ? this.input.placeholderChar : "-",
						extentLength = numLen(this.getDisplayExtent(dial));

					dialData.value = null;
					dialData.displayVal = repeat(placeholderChar, extentLength);
				} else {
					let displayVal = value;

					if (typeof dial.display == "function")
						displayVal = dial.display(this.input, displayVal, dialData.runtime);

					if (typeof dial.modifyDisplay == "function")
						dial.modifyDisplay(this.input, value, dialData.runtime);

					displayVal = String(displayVal);
					const targetLen = this.res(dial.minDisplayLength, dialData.runtime);

					if (typeof targetLen == "number")
						displayVal = padStart(displayVal, targetLen, "0");

					dialData.value = value;
					dialData.displayVal = displayVal;
				}
			},
			getValueFromTimestamp(dial, timestamp) {
				if (dial.getValueFromTimestamp == "function")
					return dial.getValueFromTimestamp(this.input, timestamp);
					
				const multiplier = this.res(dial.multiplier),
					extent = this.res(dial.extent);

				return Math.floor(timestamp / multiplier) % extent
			},
			getDisplayExtent(dial) {
				return this.res(dial.displayExtent == null ?
					dial.extent :
					dial.displayExtent
				);
			},
			moveActiveIdx(steps) {
				const dLen = this.dialsData[this.activeDialsIdx].dials.length,
					idx = Math.min(this.activeIndices[this.activeDialsIdx], dLen);

				this.activeIndices[this.activeDialsIdx] = (dLen + idx + steps) % dLen;
			},
			select(payload, idx) {
				const dials = this.dialsData[idx].dials,
					activeIdx = this.activeIndices[idx];

				if (payload.value != null)
					this.setDialValue(dials[activeIdx], payload.value);
				
				this.activeIndices[this.activeDialsIdx] = payload.nextIdx;
				this.$emit("trigger");
			},
			change(idx) {
				this.activeDialsIdx = idx;
				this.$emit("trigger");
			},
			emitDisplayData() {
				const dd = {
					dialsData: this.dialsData,
					activeIndices: this.activeIndices,
					setActiveIdx: (newIdx, relative = true, cap = true) => {
						const dLen = this.dialsData[this.activeDialsIdx].dials.length,
							idx = Math.min(this.activeIndices[this.activeDialsIdx], dLen);

						if (relative)
							this.activeIndices[this.activeDialsIdx] = cap ? ((dLen + (idx % dLen) + newIdx) % dLen) : (idx + newIdx);
						else
							this.activeIndices[this.activeDialsIdx] = cap ? Math.min(Math.max(idx, 0), dLen - 1) : newIdx;

						this.updates++;
					},
					resetIndices: _ => {
						for (let i = 0, l = this.activeIndices.length; i < l; i++)
							this.activeIndices[i] = 0;

						this.updates++;
					}
				};

				this.$emit("displaydatachange", dd);
			},
			res(val, ...args) {
				if (typeof val == "function")
					return val.call(this, this.input, ...args);

				return val;
			}
		},
		props: {
			input: Time
		},
		components: {
			Dials
		},
		watch: {
			"input.value"() {
				this.updateDialsData(true);
			}
		},
		beforeMount() {
			this.updateDialsData();
		}
	};
</script>
