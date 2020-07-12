import {
	inject,
	hasOwn,
	isObject,
	resolveVal
} from "@qtxr/utils";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
	WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DATE_CARDS = {
	day: {
		name: "day",
		accessor: "day",
		defaultCard: false,
		dayOffset: 1,
		labels: runtime => resolveVal(runtime.input.dayLabels, runtime) || WEEKDAY_LABELS,
		display: (runtime, subVal, labels) => subVal,
		back: null,
		forwards: null,
		guideSize: true,
		hideHeader: false,
		staticHeight: false
	},
	month: {
		name: "month",
		accessor: "month",
		defaultCard: false,
		labels: runtime => resolveVal(runtime.input.monthLabels, runtime) || MONTH_LABELS,
		display: (runtime, subVal, labels) => labels[subVal],
		back: null,
		forwards: null,
		guideSize: false,
		hideHeader: false,
		staticHeight: true
	},
	year: {
		name: "year",
		accessor: "year",
		defaultCard: false,
		labels: null,
		display: (runtime, subVal, labels) => subVal,
		back: false,
		forwards: false,
		guideSize: false,
		hideHeader: true,
		staticHeight: false
	}
};

const CARD_ORDER = ["day", "month", "year"],
	DEFAULT_CARDS = ["day", "month", "year"];

export default function resolveCards(cards = DEFAULT_CARDS) {
	const outCards = [],
		nameMap = {};
	let hasGuideSize = false;

	const resolve = card => {
		if (typeof card == "string") {
			if (!hasOwn(DATE_CARDS, card))
				throw new Error(`Cannot resolve card: '${card}' is not a known card template`);

			card = DATE_CARDS[card];
		}

		if (!isObject(card))
			throw new Error("Cannot resolve card: dial must be a string or object");

		if (!card.name || typeof card.name != "string")
			throw new TypeError("Cannot resolve card: no valid name provided");

		if (hasOwn(nameMap, card.name))
			throw new Error(`Cannot resolve card: card by name '${card.name}' already defined`);
		nameMap[card.name] = true;

		if (hasOwn(DATE_CARDS, card.name))
			card = inject(card, DATE_CARDS[card.name], "cloneTarget");

		if (card.guideSize)
			hasGuideSize = true;

		outCards.push(card);
	};

	if (Array.isArray(cards)) {
		for (let i = 0, l = cards.length; i < l; i++)
			resolve(cards[i]);
	}

	if (!isObject(cards)) {
		return {
			cards: outCards,
			hasGuideSize
		};
	}

	for (let i = 0, l = CARD_ORDER.length; i < l; i++) {
		const name = CARD_ORDER[i];

		if (!hasOwn(cards, name))
			continue;

		if (isObject(cards[name])) {
			resolve(Object.assign({
				name
			}, cards[name]));
		} else
			resolve(cards[name]);
	}

	return {
		cards: outCards,
		hasGuideSize
	};
}

export {
	DATE_CARDS
};
