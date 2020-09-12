<template lang="pug">
	.time-selector
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
		get,
		numLen,
		repeat,
		padStart
	} from "@qtxr/utils";
	import EVT from "@qtxr/evt";
	import utilMixin from "../util-mixin";

	import Dials from "./dials.vue";

	export default {
		name: "TimeSelector",
		mixins: [utilMixin],
		data: _ => ({
			updates: 0,
			dialsData: [],
			activeIndices: [],
			activeDialsIdx: 0
		}),
		methods: {
			updateDialsData(mergeIndices) {
				const dialsData = [],
					activeIndices = [];

				const addDialsData = timeData => {
					const runtime = {
							meridiem: null,
							defaultIdx: 0,
							dials: []
						},
						dials = this.input.dials,
						idx = activeIndices.length;

					for (let i = 0, l = dials.length; i < l; i++) {
						const dial = dials[i],
							dialData = this.mkDialData(dial, runtime),
							value = get(timeData, dialData.dial.accessor, null);

						this.setDialValue(dialData, value);
						if (dialData.dial.defaultDial)
							runtime.defaultIdx = i;

						runtime.dials.push(dialData);
					}

					dialsData.push(runtime);
					activeIndices.push(mergeIndices ?
						(typeof this.activeIndices[idx] == "number" ?
							this.activeIndices[idx] :
							runtime.defaultIdx) :
						runtime.defaultIdx
					);

					return runtime;
				};

				if (this.input.range) {
					for (let i = 0, l = this.input.value.length; i < l; i++)
						addDialsData(this.input.value[i]);
				} else
					addDialsData(this.input.value);

				this.dialsData = dialsData;
				this.activeIndices = activeIndices;
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
						displayVal = this.res(dial.display, displayVal, dialData.runtime);

					if (typeof dial.modifyDisplay == "function")
						this.res(dial.modifyDisplay, value, dialData.runtime);

					displayVal = String(displayVal);
					const targetLen = this.res(dial.minDisplayLength, dialData.runtime);

					if (typeof targetLen == "number")
						displayVal = padStart(displayVal, targetLen, "0");

					dialData.value = value;
					dialData.displayVal = displayVal;
				}
			},
			getDisplayExtent(dial) {
				return this.res(dial.displayExtent == null ?
					dial.extent :
					dial.displayExtent
				);
			},
			select(payload, idx) {
				const dials = this.dialsData[idx].dials,
					activeIdx = this.activeIndices[idx];

				if (payload.value != null)
					this.setDialValue(dials[activeIdx], payload.value);

				this.activeIndices[this.activeDialsIdx] = payload.nextIdx;
				this.emitDisplayData();
				this.$emit("trigger");

				if (!this.input.range && this.eagerCollapse && this.dropRuntime) {
					if (!this.dialsData[0].dials[payload.nextIdx])
						this.dropRuntime.collapse();
				}
			},
			change(idx) {
				this.activeDialsIdx = idx;
				this.$emit("trigger");
			},
			emitDisplayData() {
				this.$emit("displaydatachange", {
					dialsData: this.dialsData,
					activeIndices: this.activeIndices,
					setActiveIdx: this.setActiveIdx,
					resetDisplay: this.resetDisplay
				});
				this.updates++;
			},
			setActiveIdx(newIdx, relative = true, cap = true) {
				const dLen = this.dialsData[this.activeDialsIdx].dials.length,
					idx = Math.min(this.activeIndices[this.activeDialsIdx], dLen);

				if (relative) {
					this.activeIndices[this.activeDialsIdx] = cap ?
						((dLen + (idx % dLen) + newIdx) % dLen) :
						(idx + newIdx);
				} else {
					this.activeIndices[this.activeDialsIdx] = cap ?
						Math.min(Math.max(idx, 0), dLen - 1) :
						newIdx;
				}

				this.emitDisplayData();
			},
			resetDisplay() {
				for (let i = 0, l = this.activeIndices.length; i < l; i++)
					this.activeIndices[i] = this.dialsData[i].defaultIdx;

				this.emitDisplayData();
			}
		},
		props: {
			input: null,
			dropRuntime: Object,
			eagerCollapse: Boolean
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
