<template lang="pug">
	Drop.input-wrapper.date.inp-date(
		v-bind="propPassthrough"
		:class="classes"
		:adaptive="true"
		:scrollTargets="['.year-scroll', { node: '.drop-dropdown-scroll', tolerance: 10 }]"
		:aria-invalid="err"
		ref="drop"
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
				ref="selector"
				@displaydatachange="dd => dateDisplayData = dd"
				@trigger="trigger")
</template>

<script>
	import {
		set,
		hasAncestor
	} from "@qtxr/utils";
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
			move(evt, direction) {
				const el = this.$refs.drop.$el,
					target = this.getFocusNode();

				if (!target)
					return false;

				const grid = target.parentNode.parentNode,
					bounded = grid.classList.contains("bounded");
				let newTarget = null;

				if (direction == "home") {
					if (bounded && (evt.ctrlKey || evt.metaKey))
						newTarget = grid.querySelector(".bordered-row .bordered-cell:not(:disabled)");
					else
						newTarget = target.parentNode.querySelector(".bordered-cell:not(:disabled)");
				} else if (direction == "end") {
					let nodes = null;

					if (bounded && (evt.ctrlKey || evt.metaKey))
						nodes = grid.querySelectorAll(".bordered-row:last-child .bordered-cell:not(:disabled)");
					else
						nodes = target.parentNode.querySelectorAll(".bordered-cell:not(:disabled)");

					newTarget = nodes[nodes.length - 1];
				} else if (!this.focusInView())
					newTarget = target;
				else if (direction == "left")
					newTarget = target.previousElementSibling;
				else if (direction == "right")
					newTarget = target.nextElementSibling;
				else {
					const row = direction == "up" ?
						target.parentNode.previousElementSibling :
						target.parentNode.nextElementSibling;

					if (!row)
						return false;

					newTarget = row.children[this.getElemIndex(target)];
				}

				if (!newTarget || newTarget.disabled)
					return false;

				newTarget.focus();
				return true;
			},
			getElemIndex(elem) {
				let idx = 0;

				while (elem = elem.previousElementSibling)
					idx++;

				return idx;
			},
			focusInView() {
				const wrapper = this.$refs.selector.$el.querySelector(".date-selector-cards");
				if (!wrapper)
					return false;

				return hasAncestor(document.activeElement, wrapper);
			},
			getFocusNode() {
				const el = this.$refs.drop.$el,
					selectors = [
						".date-selector-card.active .bordered-cell:focus",
						".date-selector-card.active .bordered-cell.active",
						".date-selector-card.active .bordered-cell.current-year:not(:disabled)",
						".date-selector-card.active .bordered-cell:not(:disabled)"
					];
				
				for (let i = 0, l = selectors.length; i < l; i++) {
					const node = el.querySelector(selectors[i]);
					if (node)
						return node;
				}

				return null;
			},
			key(evt, key, runtime) {
				switch (key) {
					case "enter":
						if (runtime.hasNeutralTarget()) {
							runtime.collapse();
							evt.preventDefault();
						}
						break;

					case "space":
						if (!this.focusInView) {
							const node = this.getFocusNode();
							if (node)
								node.focus();
						}
						break;

					case "up":
					case "down":
					case "left":
					case "right":
					case "home":
					case "end":
						if (this.move(evt, key))
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
