<template lang="pug">
	.date-selector(
		:class="{ 'guide-size': input.hasGuideSize, 'hide-header': input.cards[activeCardsIdx].hideHeader }"
		:style="getSelectorStyle()"
		ref="selector")
		.card-header
			button.card-move.back.lag-blur(
				:style="{ visibility: input.cards[activeCardsIdx].back == false ? 'hidden' : null }"
				@click="back(input.cards[activeCardsIdx])")
			button.card-nav.lag-blur(@click="nextCard") {{ navLabel }}
			button.card-move.forwards.lag-blur(
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
							v-bind="bind({ card })")
</template>

<script>
	import {
		get,
		isObject,
		isFiniteNum,
		requestFrame
	} from "@qtxr/utils";
	import EVT from "@qtxr/evt";
	import { Date as DateInput } from "@qtxr/form";
	import utilMixin from "../util-mixin";

	export default {
		name: "DateSelector",
		mixins: [utilMixin],
		data: _ => ({
			cardsData: [],
			activeCardsIdx: 0,
			defaultCardsIdx: 0,
			activeDisplay: null,
			displayIdx: 0,
			yearRows: null,
			cache: {
				calendarRows: null
			}
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
				if (!this.isActiveCard(card) && this.cache.calendarRows)
					return this.cache.calendarRows;

				const rows = [],
					val = this.input.value,
					isRange = this.input.range,
					start = isRange ? val[0] : val,
					startHash = this.hashDate(start),
					end = isRange ? val[1] : val,
					endHash = this.hashDate(end),
					ad = this.getActiveDisplay(),
					minDateHash = this.hashDate(this.input.minDate),
					maxDateHash = this.hashDate(this.input.maxDate);

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
							isEnd = isRange && activeEnd,
							isDisabled = hash < minDateHash || (maxDateHash > -1 && hash > maxDateHash);

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
								disabled: isDisabled,
								"out-of-bounds": oob || isDisabled,
								"in-range": inRange,
								"top-corner": j == i && lastActiveIdx > 0,
								"bottom-corner": false
							},
							setDay: _ => {
								if (isDisabled)
									return;

								const d = new Date(ad.year, ad.month, j);

								if (isRange && !start.daySet) {
									this.displayIdx = 0;
									this.setActiveDisplayAndTrigger(d, card, 0);
									this.setActiveDisplayAndTrigger(d, card, 1);
								} else if (isRange) {
									const startTime = new Date(start.year, start.month, start.day).getTime(),
										currentTime = d.getTime();

									if (currentTime < startTime || isEnd) {
										this.displayIdx = 0;
										this.setActiveDisplayAndTrigger(d, card, 0);
									} else {
										this.displayIdx = 1;
										this.setActiveDisplayAndTrigger(d, card, 1);
									}
								} else
									this.setActiveDisplayAndTrigger(d, card);

								this.previousCard();
							}
						};
						
						row.cells.push(cell);
					}

					lastActiveIdx = aIdx;
					rows.push(row);
				}

				this.cache.calendarRows = rows;
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
					minDateHash = this.hashDate(this.input.minDate, 2),
					maxDateHash = this.hashDate(this.input.maxDate, 2),
					w = 4,
					h = 3;

				for (let i = 0; i < h; i++) {
					const row = [];

					for (let j = 0; j < w; j++) {
						const month = i * w + j,
							monthHash = ad.year * 12 + month,
							isDisabled = monthHash < minDateHash || (maxDateHash > -1 && monthHash > maxDateHash);

						const cell = {
							value: labels[month],
							class: {
								active: node.year == ad.year && node.month == month && node.monthSet,
								disabled: isDisabled
							},
							setMonth: _ => {
								if (isDisabled)
									return;

								this.setMonth(month, card, node);
							}
						};

						row.push(cell);
					}

					rows.push(row);
				}

				return rows;
			},
			setMonth(month, card, node) {
				const minDate = this.getDate(this.input.minDate);
				node.year = this.getActiveDisplay().year;
				node.month = month;

				if (minDate && minDate.getFullYear() == node.year && minDate.getMonth() == month)
					node.day = minDate.getDate();
				else
					node.day = 1;
		
				this.setActiveDisplayAndTrigger(node, card);
				this.previousCard();
			},
			// Year card
			getYearRows() {
				const rows = this.genYearRows({
					offset: this.getActiveDisplay().year,
					padding: 20
				});

				requestFrame(_ => {
					const scroll = this.$refs.yearScroll[0],
						bcr = scroll.getBoundingClientRect();

					scroll.scrollTop = (scroll.scrollHeight - bcr.height) / 2;
				});

				this.yearRows = rows;
				return rows;
			},
			genYearRows(options) {
				const rows = [],
					val = this.input.value,
					isRange = this.input.range,
					node = isRange ? val[this.displayIdx] : val,
					minDateHash = this.hashDate(this.input.minDate, 1),
					maxDateHash = this.hashDate(this.input.maxDate, 1),
					offset = Math.floor(options.offset / 4) * 4,
					start = -(options.paddingStart || options.padding || 0),
					end = 1 + (options.paddingEnd || options.padding || 0)

				for (let i = start; i < end; i++) {
					const row = [];

					for (let j = 0; j < 4; j++) {
						const year = offset + i * 4 + j,
							isDisabled = year < minDateHash || (maxDateHash > -1 && year > maxDateHash);

						const cell = {
							value: year,
							class: {
								active: node.year == year && node.yearSet,
								disabled: isDisabled
							},
							setYear: _ => {
								if (isDisabled)
									return;

								this.setYear(year, this.input.cards[this.activeCardsIdx], node);
							}
						};

						row.push(cell);
					}

					rows.push(row);
				}

				return rows;
			},
			setYear(year, card, node) {
				const minDate = this.getDate(this.input.minDate);

				if (minDate && minDate.getFullYear() == year) {
					node.month = minDate.getMonth();
					node.day = minDate.getDate();
				} else {
					node.month = 0;
					node.day = 1;
				}

				node.year = year;
				this.setActiveDisplayAndTrigger(node, card);
				this.previousCard();
			},
			handleYearScroll(evt) {
				const scrollTarget = evt.target,
					scrollTop = scrollTarget.scrollTop,
					scrollHeight = scrollTarget.scrollHeight,
					scrollRealEstate = scrollHeight - scrollTarget.offsetHeight,
					rowHeight = scrollHeight / scrollTarget.childElementCount,
					threshold = scrollHeight / 10,
					shift = 20;

				if (scrollTop < threshold) {
					const rows = this.genYearRows({
						offset: this.yearRows[0][0].value,
						paddingStart: shift,
						paddingEnd: -1
					});

					this.yearRows = rows.concat(this.yearRows.slice(0, -shift));
					scrollTarget.scrollTop += shift * rowHeight;
				} else if (scrollRealEstate - scrollTop < threshold) {
					const rows = this.genYearRows({
						offset: this.yearRows[this.yearRows.length - 1][0].value,
						paddingStart: 1,
						paddingEnd: shift
					});

					this.yearRows = this.yearRows.slice(shift).concat(rows);
					scrollTarget.scrollTop -= shift * rowHeight;
				}
			},
			// Other methods pertinent to UI
			back(card) {
				const ad = this.getActiveDisplay();

				if (typeof card.back == "function")
					this.res(card.back, this);
				else switch (card.name) {
					case "month":
						this.setActiveDisplay({
							year: ad.year - 1
						});
						break;

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
					case "month":
						this.setActiveDisplay({
							year: ad.year + 1
						});
						break;

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
				else if (!this.input.range && this.eagerCollapse && this.dropRuntime)
					this.dropRuntime.collapse();
			},
			// General methods
			hashDate(d, precision = 3) {
				let year = null,
					month = null,
					day = null;

				if (isObject(d)) {
					year = d.year;
					month = d.month;
					day = d.day;
				} else {
					const date = this.getDate(d);

					if (!date)
						return -1;

					year = date.getFullYear();
					month = date.getMonth();
					day = date.getDate();
				}

				switch (precision) {
					case 1:
						return year;

					case 2:
						return year * 12 + month;

					case 3:
					default:
						return (year * 12 + month) * 50 + day;
				}
			},
			getDate(dateData) {
				let date = this.res(dateData);

				switch (typeof date) {
					case "number":
					case "string":
						date = new Date(date);
						break;
				}

				if (date instanceof Date && !isNaN(date.valueOf()))
					return date;

				return null;
			},
			updateCardsData() {
				const cardsData = [];
				this.defaultCardsIdx = 0;

				const addCardsData = ad => {
					const runtime = {
							defaultIdx: 0,
							set: {
								yearSet: ad.yearSet,
								monthSet: ad.monthSet,
								daySet: ad.daySet
							},
							cards: []
						},
						cards = this.input.cards;

					for (let i = 0, l = cards.length; i < l; i++) {
						const card = cards[i],
							cardData = this.mkCardData(card, runtime),
							value = get(ad, cardData.card.name, null);

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
					for (let i = 0, l = this.activeDisplay.length; i < l; i++)
						addCardsData(this.activeDisplay[i]);
				} else
					addCardsData(this.activeDisplay);

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
			isActiveCard(card) {
				return this.input.cards[this.activeCardsIdx] == card;
			},
			trigger(card, idx) {
				const set = ad => {
					let foundIdx = false;

					for (let i = 0, l = this.input.cards.length; i < l; i++) {
						const c = this.input.cards[i];
						if (c == card)
							foundIdx = true;

						ad[`${c.name}Set`] = foundIdx;
					}
				};

				const val = this.input.value;

				if (Array.isArray(val)) {
					if (typeof idx == "number")
						set(this.activeDisplay[idx]);
					else {
						for (let i = 0, l = val.length; i < l; i++)
							set(this.activeDisplay[i]);
					}
				} else
					set(this.activeDisplay);

				this.updateCardsData();
				this.$emit("trigger");
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
				const card = this.input.cards[this.activeCardsIdx];

				if (card.staticHeight || card.hideHeader) {
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
			setActiveDisplayAndTrigger(data, card, idx = this.displayIdx) {
				this.setActiveDisplay(data, idx);
				this.trigger(card, idx);
			},
			setActiveDisplay(data, idx = this.displayIdx) {
				const set = (ad, d) => {
					if (d instanceof Date) {
						d = {
							year: d.getFullYear(),
							month: d.getMonth(),
							day: d.getDate()
						};
					}

					for (const k in d) {
						if (!d.hasOwnProperty(k))
							continue;

						switch (k) {
							case "year":
							case "month":
							case "day":
								if (isFiniteNum(d[k]))
									ad[k] = d[k];
								break;

							default:
								if (!ad.hasOwnProperty(k))
									ad[k] = d[k];
						}
					}
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
			}
		},
		computed: {
			navLabel() {
				return this.getLabels(this.activeCardsIdx + 1, true).join(" ");
			}
		},
		props: {
			input: null,
			dropRuntime: Object,
			eagerCollapse: Boolean
		},
		components: {},
		watch: {
			"input.value"() {
				this.setActiveDisplay(this.input.value);
				this.updateCardsData();
				this.yearRows = null;
			},
			activeCardsIdx() {
				this.yearRows = null;
			}
		},
		beforeMount() {
			this.setActiveDisplay(this.input.value);
			this.updateCardsData();
		}
	};
</script>
