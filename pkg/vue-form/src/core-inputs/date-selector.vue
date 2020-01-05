<template lang="pug">
	.date-selector(
		:class="{ 'guide-size': input.hasGuideSize, 'hide-header': input.cards[activeCardsIdx].hideHeader }"
		:style="getSelectorStyle()"
		ref="selector")
		.card-header
			button.card-move.back(
				:style="{ visibility: input.cards[activeCardsIdx].back == false ? 'hidden' : null }"
				@click="back(input.cards[activeCardsIdx])")
			.card-nav(@click="nextCard") {{ navLabel }}
			button.card-move.forwards(
				:style="{ visibility: input.cards[activeCardsIdx].forwards == false ? 'hidden' : null }"
				@click="forwards(input.cards[activeCardsIdx])")
		.date-selector-cards
			template(v-for="(card, idx) in input.cards")
				.date-selector-card(
					v-if="card.guideSize || idx == activeCardsIdx"
					:class="[ `${card.name}-card`, card.guideSize ? 'guide' : null ]"
					:style="{ visibility: idx == activeCardsIdx ? 'visible' : 'hidden' }")
					template(v-if="card.name == 'day'")
						.calendar-labels
							.calendar-label(v-for="label in getCalendarLabels(card)") {{ label }}
						template(v-for="row in getCalendarRows(card)")
							.calendar-row.bordered-row(:class="row.class")
								template(v-for="cell in row.cells")
									.calendar-cell.bordered-cell(
										:class="cell.class"
										@click="cell.setDay")
										.cell-highlight
										span {{ cell.value }}
					template(v-else-if="card.name == 'month'")
						template(v-for="row in getMonthRows(card)")
							.month-row.bordered-row
								template(v-for="cell in row")
									.month-cell.bordered-cell(
										:class="cell.class"
										@click="cell.setMonth")
										.cell-highlight
										span {{ cell.value }}
					template(v-else-if="card.name == 'year'")
						.year-scroll(
							ref="yearScroll"
							@scroll="handleYearScroll")
							template(v-for="row in yearRows || getYearRows()")
								.year-row.bordered-row
									template(v-for="cell in row")
										.year-cell.bordered-cell(
											:class="cell.class"
											@click="cell.setYear")
											.cell-highlight
											span {{ cell.value }}
					template(v-else)
						slot(
							:name="`${card.name}-card`"
							v-bind="{ self: this, card, input }")
</template>

<script>
	import {
		get,
		requestFrame,
		isFiniteNum
	} from "@qtxr/utils";
	import EVT from "@qtxr/evt";
	import { Date as DateInput } from "@qtxr/form";

	export default {
		name: "DateSelector",
		data: _ => ({
			cardsData: [],
			activeCardsIdx: 0,
			defaultCardsIdx: 0,
			activeDisplay: null,
			displayIdx: 0,
			yearRows: null
		}),
		methods: {
			// Day card
			getCalendarLabels(card) {
				const labels = this.res(card.labels) || [],
					labelsOut = [],
					offset = this.res(card.dayOffset) || 0;

				for (let i = 0; i < 7; i++) {
					const idx = (7 + (offset + i) % 7) % 7;
					labelsOut.push(labels[idx]);
				}

				return labelsOut;
			},
			getCalendarRows(card) {
				const rows = [],
					val = this.input.value,
					isRange = this.input.range,
					start = isRange ? val[0] : val,
					startHash = this.hashDate(start),
					end = isRange ? val[1] : val,
					endHash = this.hashDate(end),
					ad = this.getActiveDisplay();

				const adDate = new Date(ad.year, ad.month),
					monthLen = new Date(ad.year, ad.month + 1, 0).getDate(),
					prevMonthLen = new Date(ad.year, ad.month, 0).getDate(),
					startIdx = (7 + (adDate.getDay() - (this.res(card.dayOffset) || 0)) % 7) % 7,
					todayDate = new Date(),
					day = todayDate.getDate(),
					isActiveMonth = todayDate.getFullYear() == ad.year && todayDate.getMonth() == ad.month;

				let lastActiveIdx = -1;

				for (let i = 1 - startIdx; i <= monthLen; i += 7) {
					const row = {
						cells: [],
						class: []
					};
					let aIdx = -1;

					for (let j = i; j < i + 7; j++) {
						let value = j,
							monthOffs = 0;

						if (j < 1) {
							value = prevMonthLen + j;
							monthOffs = -1;
						} else if (j > monthLen) {
							value = j - monthLen;
							monthOffs = 1;
						}

						const oob = j < 1 || j > monthLen,
							hash = (ad.year * 12 + ad.month + monthOffs) * 50 + value,
							activeStart = (start.day == value && start.daySet) && startHash == hash,
							activeEnd = (end.day == value && end.daySet) && endHash == hash,
							active = activeStart || activeEnd,
							inRange = startHash == endHash ?
								isRange && active :
								isRange && (hash >= startHash && hash <= endHash),
							isStart = isRange && activeStart,
							isEnd = isRange && activeEnd;

						if (active) {
							if (aIdx == -1 && (j - i) < 6 && rows.length)
								rows[rows.length - 1].cells[6].class["bottom-corner"] = true;
						
							aIdx = j - i;
						}

						if (activeStart)
							row.class.push("active-start");

						if (activeEnd)
							row.class.push("active-end");

						const cell = {
							value,
							class: {
								active,
								start: isStart,
								end: isEnd,
								today: j == day && isActiveMonth && !oob,
								"out-of-bounds": oob,
								"in-range": inRange,
								"top-corner": j == i && lastActiveIdx > 0,
								"bottom-corner": false
							},
							setDay: _ => {
								const d = new Date(ad.year, ad.month, j);

								if (isRange && !start.daySet) {
									this.displayIdx = 0;
									this.setActiveDisplayAndTrigger(d, 0);
									this.setActiveDisplayAndTrigger(d, 1);
								} else if (isRange) {
									const startTime = new Date(start.year, start.month, start.day).getTime(),
										currentTime = d.getTime();

									if (currentTime < startTime || isEnd) {
										this.displayIdx = 0;
										this.setActiveDisplayAndTrigger(d, 0);
									} else {
										this.displayIdx = 1;
										this.setActiveDisplayAndTrigger(d, 1);
									}
								} else
									this.setActiveDisplayAndTrigger(d);

								this.previousCard();
							}
						};
						
						row.cells.push(cell);
					}

					lastActiveIdx = aIdx;
					rows.push(row);
				}

				return rows;
			},
			// Month card
			getMonthRows(card) {
				const rows = [],
					val = this.input.value,
					isRange = this.input.range,
					node = isRange ? val[this.displayIdx] : val,
					ad = this.getActiveDisplay(),
					labels = this.res(card.labels),
					w = 4,
					h = 3;

				for (let i = 0; i < h; i++) {
					const row = [];

					for (let j = 0; j < w; j++) {
						const month = i * w + j;

						const cell = {
							value: labels[month],
							class: {
								active: node.month == month && node.monthSet
							},
							setMonth: _ => this.setMonth(month, node)
						};

						row.push(cell);
					}

					rows.push(row);
				}

				return rows;
			},
			setMonth(month, node) {
				node.month = month;
				node.day = 1;
				this.setActiveDisplayAndTrigger(node);
				node.daySet = false;
				this.previousCard();
			},
			// Year card
			getYearRows() {
				const rows = [],
					val = this.input.value,
					isRange = this.input.range,
					node = isRange ? val[this.displayIdx] : val,
					ad = this.getActiveDisplay(),
					w = 4,
					offset = Math.floor(ad.year / w) * w,
					rowPadding = 20;

				for (let i = -rowPadding; i <= rowPadding; i++) {
					const row = [];

					for (let j = 0; j < w; j++) {
						const year = offset + i * w + j;

						const cell = {
							value: year,
							class: {
								active: node.year == year && node.yearSet
							},
							setYear: _ => this.setYear(year, node)
						};

						row.push(cell);
					}

					rows.push(row);
				}

				requestFrame(_ => {
					const scroll = this.$refs.yearScroll[0],
						bcr = scroll.getBoundingClientRect();

					scroll.scrollTop = (scroll.scrollHeight - bcr.height) / 2;
				});

				this.yearRows = rows;
				return rows;
			},
			setYear(year, node) {
				node.year = year;
				node.month = 0;
				node.day = 1;
				this.setActiveDisplayAndTrigger(node);
				node.monthSet = false;
				node.daySet = false;
				this.previousCard();
			},
			handleYearScroll() {
				
			},
			// Other methods pertinent to UI
			hashDate(d) {
				return (d.year * 12 + d.month) * 50 + d.day;
			},
			back(card) {
				const ad = this.getActiveDisplay();

				if (typeof card.back == "function")
					this.res(card.back, this);
				else switch (card.name) {
					case "day":
						this.setActiveDisplay({
							year: ad.month ? ad.year : ad.year - 1,
							month: ad.month ? ad.month - 1 : 11
						});
						break;
				}
			},
			forwards(card) {
				const ad = this.getActiveDisplay();

				if (typeof card.forwards == "function")
					this.res(card.forwards, this);
				else switch (card.name) {
					case "day":
						this.setActiveDisplay({
							year: ad.month < 11 ? ad.year : ad.year + 1,
							month: (ad.month + 1) % 12
						});
						break;
				}
			},
			nextCard() {
				if (this.activeCardsIdx < this.input.cards.length - 1)
					this.activeCardsIdx++;
			},
			previousCard() {
				if (this.activeCardsIdx > 0)
					this.activeCardsIdx--;
			},
			// General methods
			updateCardsData() {
				const cardsData = [];
				this.defaultCardsIdx = 0;

				const addCardsData = dateData => {
					const runtime = {
							defaultIdx: 0,
							cards: []
						},
						cards = this.input.cards;

					for (let i = 0, l = cards.length; i < l; i++) {
						const card = cards[i],
							cardData = this.mkCardData(card, runtime),
							value = get(dateData, cardData.card.accessor, null);

						this.setCardValue(cardData, value);
						if (cardData.card.defaultCard) {
							runtime.defaultIdx = i;
							this.defaultCardsIdx = i;
						}

						runtime.cards.push(cardData);
					}

					cardsData.push(runtime);
					return runtime;
				};

				if (this.input.range) {
					for (let i = 0, l = this.input.value.length; i < l; i++)
						addCardsData(this.input.value[i]);
				} else
					addCardsData(this.input.value);

				this.cardsData = cardsData;
				this.emitDisplayData();
			},
			mkCardData(card, runtime) {
				const cardData = {
					card,
					class: card.name ? `card-display-cell-${card.name}` : null,
					value: null,
					displayVal: "",
					runtime
				};

				cardData.setValue = value => {
					this.setCardValue(cardData, value);
				};

				return cardData;
			},
			setCardValue(cardData, value) {
				let displayVal = value;

				const card = cardData.card,
					labels = this.res(card.labels),
					candidateDispVal = this.res(card.display, value, labels);

				if (candidateDispVal != null && String(candidateDispVal))
					displayVal = candidateDispVal;

				cardData.value = value;
				cardData.displayVal = String(displayVal);
			},
			trigger(idx) {
				const set = (targ, d) => {
					for (const k in d) {
						const setKey = `${k}Set`;
						if (!d.hasOwnProperty(k) || !targ.hasOwnProperty(k))
							continue;

						targ[k] = d[k];
						if (targ.hasOwnProperty(setKey))
							targ[setKey] = true;
					}
				};

				const val = this.input.value;

				if (Array.isArray(val)) {
					if (typeof idx == "number")
						set(val[idx], this.activeDisplay[idx]);
					else {
						for (let i = 0, l = val.length; i < l; i++)
							set(val[i], this.activeDisplay[i]);
					}
				} else
					set(val, this.activeDisplay);

				this.$emit("trigger");
				this.updateCardsData();
				this.emitDisplayData();
			},
			emitDisplayData() {
				this.$emit("displaydatachange", {
					cardsData: this.cardsData,
					activeIdx: this.activeCardsIdx,
					setActiveIdx: this.setActiveIdx,
					resetDisplay: this.resetDisplay
				});
			},
			getSelectorStyle() {
				if (this.input.cards[this.activeCardsIdx].hideHeader) {
					return {
						height: `${this.$refs.selector.getBoundingClientRect().height}px`
					};
				} else
					return null;
			},
			setActiveIdx(newIdx, relative = true, cap = true) {
				const cLen = this.input.cards.length,
					idx = Math.min(this.activeCardsIdx, cLen);

				if (relative)
					this.activeCardsIdx = cap ? ((cLen + (idx % cLen) + newIdx) % cLen) : (idx + newIdx);
				else
					this.activeCardsIdx = cap ? Math.min(Math.max(idx, 0), cLen - 1) : newIdx;
			},
			resetDisplay() {
				this.activeCardsIdx = this.defaultCardsIdx;
				this.displayIdx = 0;

				if (this.input.range) {
					for (let i = 0, l = this.cardsData.length; i < l; i++)
						Object.assign(this.cardsData[i], this.input.value[i]);
				} else
					Object.assign(this.cardsData[0], this.input.value);
			},
			getLabels(idx, valueOnly = false) {
				const outLabels = [];

				for (let i = idx; i < this.input.cards.length; i++) {
					const card = this.input.cards[i],
						labels = this.res(card.labels),
						ad = this.getActiveDisplay(),
						displayVal = this.res(card.display, ad[card.name], labels);

					if (displayVal == null)
						continue;

					const stringified = String(displayVal);

					if (!stringified)
						continue;

					if (valueOnly)
						outLabels.push(stringified);
					else {
						outLabels.push({
							value: stringified,
							set: Boolean(ad[`${card.name}Set`])
						});
					}
				}

				return outLabels;
			},
			setActiveDisplayAndTrigger(data, idx = this.displayIdx) {
				this.setActiveDisplay(data, idx);
				this.trigger(idx)
			},
			setActiveDisplay(data, idx = this.displayIdx) {
				const set = (ad, d) => {
					const year = d instanceof Date ? d.getFullYear() : d.year,
						month = d instanceof Date ? d.getMonth() : d.month,
						day = d instanceof Date ? d.getDate() : d.day;

					if (isFiniteNum(year))
						ad.year = year;

					if (isFiniteNum(month))
						ad.month = month;
						
					if (isFiniteNum(day))
						ad.day = day;
				};

				if (Array.isArray(data)) {
					const activeDisplay = this.activeDisplay || [];
					
					for (let i = 0, l = data.length; i < l; i++) {
						activeDisplay[i] = Object.assign({
							year: null,
							month: null,
							day: null
						}, activeDisplay[i]);

						set(activeDisplay[i], data[i]);
					}

					this.activeDisplay = activeDisplay;
				} else {
					if (Array.isArray(this.activeDisplay))
						set(this.activeDisplay[idx], data);
					else {
						const activeDisplay = Object.assign({
							year: null,
							month: null,
							day: null
						}, this.activeDisplay);

						set(activeDisplay, data);
						this.activeDisplay = activeDisplay;
					}
				}
			},
			getActiveDisplay(idx = this.displayIdx) {
				if (Array.isArray(this.activeDisplay))
					return this.activeDisplay[idx];

				return this.activeDisplay;
			},
			res(val, ...args) {
				if (typeof val == "function")
					return val.call(this, this.input, ...args);

				return val;
			}
		},
		computed: {
			navLabel() {
				return this.getLabels(this.activeCardsIdx + 1, true).join(" ");
			}
		},
		props: {
			input: null
		},
		components: {},
		watch: {
			"input.value"() {
				this.updateCardsData();
				this.setActiveDisplay(this.input.value);
				this.yearRows = null;
			},
			activeCardsIdx() {
				this.yearRows = null;
			}
		},
		beforeMount() {
			this.updateCardsData();
			this.setActiveDisplay(this.input.value);
		}
	};
</script>
