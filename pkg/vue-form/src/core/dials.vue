<template lang="pug">
	.dials-wrapper
		.dials(
			:class="{ hovering }"
			@mousemove="moveHand"
			@mouseleave="exitHand"
			@click="select"
			ref="dials")
			.dial.background-dial
			.dial.edit-dial(
				v-for="(dialData, idx) in dials"
				:class="{ active: idx == activeIdx, collapsed: idx < activeIdx, hidden: idx > activeIdx }")
				.dial-delimitation-bounds
					template(v-for="delimitation in getDelimiters(dialData.dial)")
						.dial-delimitation-tick(
							v-if="delimitation.isTick"
							:style="delimitation.position")
						.dial-delimitation(
							v-else
							:style="delimitation.position") {{ delimitation.value }}
					.dial-selector-hand.active-hand(:style="getSelectorHandStyle(dialData)")
						.dial-selector-blob(:style="getSelectorBlobStyle(dialData)") {{ dialData.displayVal }}
					.dial-selector-hand.guide(:style="guideHandStyle")
						.dial-selector-blob(:style="guideBlobStyle") {{ guideData.displayVal }}
					.hand-blob
			.dial.result-dial(:class="{ active: activeIdx == dials.length, collapsed: activeIdx != dials.length }")
				.dial-delimitation-bounds.tight
					template(v-for="delimitation in getDelimiters(input.resultDial)")
						.dial-delimitation-tick(
							v-if="delimitation.isTick"
							:style="delimitation.position")
						.dial-delimitation(
							v-else
							:style="delimitation.position") {{ delimitation.value }}
					.result-hands
						.result-hand(
							v-for="dialData in dials"
							:style="getResultHandStyle(dialData)")
							.result-hand-fill(:style="getResultHandFillStyle(dialData)")
						.hand-blob
		.short-actions
			template(v-for="action in getShortActions()")
				.short-action-row
					button.short-action-button(
						v-for="button in action.buttons"
						:class="button.class"
						tabindex="-1"
						type="button"
						@click="button.act") {{ button.label }}
</template>

<script>
	import {
		get,
		isObject,
		padStart,
		roundCustom
	} from "@qtxr/utils";
	import EVT from "@qtxr/evt";
	import utilMixin from "../util-mixin";

	export default {
		name: "Dials",
		mixins: [utilMixin],
		data: _ => ({
			hovering: false,
			guideData: {
				value: 0,
				displayVal: "",
				perc: null
			}
		}),
		methods: {
			getDelimiters(dial) {
				const delimiters = [],
					extent = this.res(dial.displayExtent),
					delimitations = this.res(dial.delimitations),
					resolution = this.res(dial.resolution) || 1,
					tickResolution = this.res(dial.tickResolution),
					shift = this.getShift(dial);

				const getPos = turns => {
					return {
						top: `${50 - Math.cos(turns * Math.PI * 2) * 50}%`,
						left: `${50 + Math.sin(turns * Math.PI * 2) * 50}%`
					}
				};

				for (let i = 0; i < delimitations; i++) {
					const pt = i + shift,
						delimitation = (extent / delimitations) * pt;

					delimiters.push({
						value: typeof dial.displayDelimiter == "function" ?
							dial.displayDelimiter(delimitation) :
							this.getDisplayVal(
								roundCustom(delimitation, resolution),
								dial
							),
						position: getPos(pt / delimitations)
					});

					if (typeof tickResolution != "number")
						continue;

					const delta = ((extent / delimitations) * (pt + 1)) - delimitation,
						ticks = Math.floor(roundCustom(delta, tickResolution / 1e6) / tickResolution);

					for (let j = 1; j < ticks; j++) {
						delimiters.push({
							isTick: true,
							position: getPos((pt + j / ticks) / delimitations)
						});
					}
				}

				return delimiters;
			},
			getSelectorHandStyle(dialData) {
				if (dialData.value == null) {
					return {
						display: "none"
					};
				}

				return {
					transform: `translateY(-50%) rotate(${this.getPerc(dialData.dial, dialData.value) - 0.25}turn)`
				};
			},
			getSelectorBlobStyle(dialData) {
				const extent = this.res(dialData.dial.extent);

				return {
					transform: `translate(50%, -50%) rotate(${-(this.getPerc(dialData.dial, dialData.value) - 0.25)}turn)`
				};
			},
			getPerc(dial, value) {
				if (typeof dial.toPerc == "function")
					return dial.toPerc(this.input, value);

				return value / this.getDisplayExtent(dial);
			},
			getGeometricPerc(dial) {
				// Dial positions are calculated using a geometric-like series
				const dials = this.dials;
				let lastPerc = 0;

				for (let i = dials.length - 1; i >= 0; i--) {
					const d = dials[i].dial,
						val = (dials[i].value || 0) + lastPerc,
						perc = this.getPerc(d, val);

					if (d == dial)
						return perc;

					lastPerc = perc;
				}

				return lastPerc
			},
			getVal(dial, perc) {
				if (typeof dial.toVal == "function")
					return dial.toVal(this.input, perc);

				const extent = this.getDisplayExtent(dial);

				return roundCustom(perc * extent, this.res(dial.resolution)) % extent;
			},
			getDisplayExtent(dial) {
				return this.res(dial.displayExtent == null ?
					dial.extent :
					dial.displayExtent
				);
			},
			getShift(dial) {
				const shift = this.res(dial.shift);

				switch (shift) {
					case "end":
						return 1;
					case "start":
					default:
						return 0;
				}
			},
			getResultHandStyle(dialData) {
				const hand = this.res(get(dialData, "dial.hand")),
					perc = this.input.geometricHands === false || hand.geometric === false ?
						this.getPerc(dialData.dial, dialData.value) :
						this.getGeometricPerc(dialData.dial);

				return {
					transform: `translateY(-50%) rotate(${perc - 0.25}turn)`
				};
			},
			getResultHandFillStyle(dialData) {
				const hand = this.res(get(dialData, "dial.hand")),
					length = this.res(get(hand, "length", 1)),
					width = this.res(get(hand, "width", 1)),
					opacity = this.res(get(hand, "opacity", 1));

				return {
					transform: `scale(${length}, ${width})`,
					opacity
				};
			},
			moveHand(evt) {
				const perc = this.getSectorPercentage(evt);

				this.hovering = perc != null && this.activeIdx != this.dials.length;

				if (this.hovering)
					this.guideData = this.getGuideData(perc);

				this.$emit("focus");
			},
			exitHand() {
				this.hovering = false;
			},
			getSectorPercentage(evt) {
				const bcr = this.$refs.dials.getBoundingClientRect(),
					coords = EVT.getCoords(evt),
					r = bcr.width / 2,
					dx = coords.x - bcr.left - r,
					dy = coords.y - bcr.top - r,
					cursorRadius = Math.sqrt(dx * dx + dy * dy);

				if (cursorRadius < r / 10)
					return null;

				return (-Math.atan2(dx, dy) + Math.PI) / (Math.PI * 2);
			},
			getGuideData(perc) {
				const dialData = this.dials[this.activeIdx],
					activeDial = dialData.dial,
					extent = this.getDisplayExtent(activeDial),
					offset = Math.floor(this.getPerc(activeDial, dialData.value)),
					value = (offset * extent) + this.getVal(activeDial, perc) % extent;

				return {
					value,
					displayVal: this.getDisplayVal(value, activeDial),
					perc: value / extent
				};
			},
			getDisplayVal(value, dial) {
				let displayVal = value;

				if (typeof dial.display == "function")
					displayVal = this.res(dial.display, value);

				displayVal = String(displayVal);

				const targetLen = this.res(dial.minDisplayLength);

				if (typeof targetLen == "number")
					displayVal = padStart(displayVal, targetLen, "0");

				return displayVal;
			},
			select(evt) {
				const isResultDial = this.activeIdx == this.dials.length,
					perc = this.getSectorPercentage(evt);

				if (perc == null && !isResultDial)
					return;

				const value = isResultDial ?
					null :
					this.getGuideData(perc).value;

				this.hovering = false;

				this.$emit("select", {
					nextIdx: (this.activeIdx + 1) % (this.dials.length + 1),
					value,
					perc
				});
			},
			getShortActions() {
				const shortActions = [];

				for (let i = 0, l = this.dials.length; i < l; i++) {
					const dialData = this.dials[i],
						dial = dialData.dial,
						value = dialData.value,
						actions = this.res(dial.shortActions, value, dialData);

					if (!isObject(actions))
						continue;

					if (this.res(actions.visible, value, dialData) === false)
						continue;

					const buttons = this.res(actions.buttons, value, dialData),
						action = {
							buttons: []
						};

					if (!Array.isArray(buttons))
						continue;

					for (let j = 0, l2 = buttons.length; i < l; i++) {
						const button = this.res(buttons[i], value, dialData);

						if (!isObject(button))
							continue;

						if (this.res(button.visible, value, dialData) === false)
							continue;

						action.buttons.push({
							label: this.res(button.label, value, dialData),
							class: this.res(button.class, value, dialData),
							act: _ => {
								const retVal = this.res(button.action, value, dialData);
								this.$emit("change");
								return retVal;
							}
						});
					}

					shortActions.push(action);
				}

				return shortActions;
			}
		},
		computed: {
			guideHandStyle() {
				if (this.guideData.perc == null)
					return null;

				return {
					transform: `translateY(-50%) rotate(${this.guideData.perc - 0.25}turn)`
				};
			},
			guideBlobStyle() {
				if (this.guideData.perc == null)
					return null;

				return {
					transform: `translate(50%, -50%) rotate(${-(this.guideData.perc - 0.25)}turn)`
				};
			}
		},
		props: {
			input: null,
			updates: Number,
			dials: Array,
			activeIdx: Number
		}
	};
</script>
