<template lang="pug">
	.input-wrapper.time.inp-time(
		:class="[ expanded ? 'open' : null, validationState, dropdownDirection ]")
		button.time-display(
			ref="expandoBox"
			@click="bufferExpand")
			template(v-for="(runtime, i) in dialsData")
				.range-sep(v-if="i > 0") {{ typeof input.rangeSeparator == "string" ? input.rangeSeparator : "-" }}
				.time-display-item
					template(v-for="(dial, j) in runtime.dials")
						span.time-sep(v-if="j > 0") {{ typeof input.timeSeparator == "string" ? input.timeSeparator : ":" }}
						span.time-display-cell(:class="[ dial.class, (expanded && activeIndices[i] == j) ? 'active' : null ]") {{ dial.displayVal }}
					span.meridiem(v-if="input.meridiem && runtime.meridiem") {{ runtime.meridiem }}
		.time-modal(
			:style="modalStyle"
			ref="modal"
			@click.stop)
			template(v-for="(d, i) in dialsData")
				Dials(
					:input="input"
					:dials="d.dials"
					:activeIdx="activeIndices[i]"
					@select="payload => select(payload, i)"
					@focus="activeIdxIdx = i"
					@change="change(i)")
</template>

<script>
	import {
		numLen,
		repeat,
		padStart,
		requestFrame
	} from "@qtxr/utils";
	import EVT from "@qtxr/evt";
	import Form, { Time } from "@qtxr/form";

	import Dials from "../components/dials.vue";

	const PADDING = 30,
		BOTTOM_BIAS = 0.5;

	export default {
		name: "Time",
		data: _ => ({
			expanded: false,
			dropdownDirection: null,
			modalStyle: null,
			updateLoopInitialized: false,
			globalClickListener: null,
			globalKeyListener: null,
			displayLiterals: {},
			dialsData: [],
			activeIndices: [],
			activeIdxIdx: 0,
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

				if (this.input.range) {
					const value = [];

					for (let i = 0, l = this.dialsData.length; i < l; i++)
						value.push(reduce(this.dialsData[i].dials));

					this.input.trigger(value);
				} else
					this.input.trigger(reduce(this.dialsData[0].dials));
			},
			toggleExpansion(expanded) {
				expanded = typeof expanded == "boolean" ? expanded : !this.expanded;

				if (expanded)
					this.expand();
				else
					this.collapse();
			},
			bufferExpand() {
				requestFrame(_ => this.expand());
			},
			expand() {
				if (this.expanded)
					return;

				this.expanded = true;
				this.initUpdateLoop();
			},
			collapse(evt) {
				if (!this.expanded)
					return;

				for (let i = 0, l = this.activeIndices.length; i < l; i++)
					this.activeIndices[i] = 0;

				this.trigger();
				this.expanded = false;
				this.dropdownDirection = null;
			},
			initUpdateLoop() {
				if (!this.updateLoopInitialized) {
					this.updateLoopInitialized = true;
					this.updateFixedBox();
				}
			},
			updateFixedBox() {
				if (!this.expanded || !this.$refs.modal) {
					this.modalStyle = null;
					this.updateLoopInitialized = false;
					return;
				}

				const style = getComputedStyle(this.$refs.modal),
					bcr = this.$refs.expandoBox.getBoundingClientRect(),
					mbcr = this.$refs.modal.getBoundingClientRect(),
					bTop = parseFloat(style.borderTopWidth),
					bRight = parseFloat(style.borderRightWidth),
					bBottom = parseFloat(style.borderBottomWidth),
					brTopLeft = parseFloat(style.borderTopRightRadius),
					brTopRight = parseFloat(style.borderTopRightRadius),
					brBottomLeft = parseFloat(style.borderBottomLeftRadius),
					brBottomRight = parseFloat(style.borderBottomRightRadius),
					bLeft = parseFloat(style.borderLeftWidth),
					topAvailable = bcr.top - PADDING,
					bottomAvailable = window.innerHeight - (bcr.top + bcr.height) - PADDING,
					placeBottom = bottomAvailable > (topAvailable * BOTTOM_BIAS) || mbcr.height < bottomAvailable - 100,
					maxHeight = placeBottom ? bottomAvailable : topAvailable,
					flushLeft = bcr.left + mbcr.width < window.innerWidth - PADDING,
					leftShift = flushLeft ?
						0 :
						bcr.left - (window.innerWidth - PADDING - mbcr.width),
					left = bcr.left - leftShift,
					rightShift = mbcr.width - bcr.width - leftShift;

				this.modalStyle = {
					position: "fixed",
					top: placeBottom ? `${bcr.top + bcr.height - bBottom}px` : null,
					bottom: placeBottom ? null : `${window.innerHeight - bcr.top - bTop}px`,
					left: `${left - Math.min(rightShift, 0)}px`,
					maxHeight: `${maxHeight}px`
				};

				this.dropdownDirection = placeBottom ? "place-bottom" : "place-top";
				
				if (placeBottom) {
					this.modalStyle.borderTopLeftRadius = `${Math.min(brBottomLeft, leftShift)}px`;
					this.modalStyle.borderTopRightRadius = `${Math.min(brBottomRight, Math.max(rightShift, 0))}px`;
				} else {
					this.modalStyle.borderBottomLeftRadius = `${Math.min(brTopLeft, leftShift)}px`;
					this.modalStyle.borderBottomRightRadius = `${Math.min(brTopRight, Math.max(rightShift, 0))}px`;
				}

				requestFrame(_ => this.updateFixedBox());
			},
			resolveDate() {
				const dateOrTimestamp = this.input.value;

				if (dateOrTimestamp instanceof Date)
					return dateOrTimestamp;

				return new Date(dateOrTimestamp);
			},
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
						out.push(getTimeDisplayItem(this.input.value[i]));
						indices.push(mergeIndices ? this.activeIndices[i] || 0 : 0);
					}

					this.dialsData = out;
					this.activeIndices = indices;
				} else {
					this.dialsData = [
						getTimeDisplayItem(this.input.value)
					];
					this.activeIndices = mergeIndices ? this.activeIndices : [0];
				}
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
			select(payload, idx) {
				const dials = this.dialsData[idx].dials,
					activeIdx = this.activeIndices[idx];

				if (payload.value != null)
					this.setDialValue(dials[activeIdx], payload.value);
				
				this.activeIndices[idx] = payload.nextIdx;
				this.trigger();
			},
			change(idx) {
				this.activeIdxIdx = idx;
				this.trigger();
			},
			moveActiveIdx(steps) {
				const dLen = this.dialsData[this.activeIdxIdx].dials.length,
					idx = Math.min(this.activeIndices[this.activeIdxIdx], dLen);

				this.activeIndices[this.activeIdxIdx] = (dLen + idx + steps) % dLen;
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
			Dials
		},
		watch: {
			"input.value"() {
				this.updateDialsData(true);
			}
		},
		beforeMount() {
			this.input.hook("update", inp => {
				this.validationState = inp.validationState;
				this.validationMsg = inp.validationMsg || this.validationMsg;
			});

			this.globalClickListener = _ => this.collapse();
			document.body.addEventListener("click", this.globalClickListener);

			this.globalKeyListener = evt => {
				if (!this.expanded)
					return;

				switch (EVT.getKey(evt)) {
					case "escape":
					case "enter":
						this.collapse();
						evt.preventDefault();
						break;

					case "left":
						this.moveActiveIdx(-1);
						break;

					case "right":
						this.moveActiveIdx(1);
						break;
				}
			};
			document.body.addEventListener("keydown", this.globalKeyListener);

			this.updateDialsData();
		},
		beforeDestroy() {
			document.body.removeEventListener("click", this.globalClickListener);
			document.body.removeEventListener("keydown", this.globalKeyListener);
		}
	};
</script>
