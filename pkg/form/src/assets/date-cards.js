import {
	inject,
	isObject,
	resolveVal
} from "@qtxr/utils";

const DATE_CARDS = {
	year: {
		name: "year",
		key: "year"
	},
	month: {
		name: "month",
		key: "month",
		labels: inp => resolveVal(inp.monthLabels, inp) || ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
	},
	day: {
		name: "day",
		accessor: "day",
		dayOffset: 0,
		labels: inp => resolveVal(inp.dayLabels, inp) || ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
	}
};

const CARD_ORDER = ["year", "month", "day"],
	DEFAULT_CARDS = ["year", "month", "day"];

export default function resolveCards(cards = DEFAULT_CARDS) {
	const outCards = [],
		nameMap = {};

	const resolve = card => {
		if (typeof card == "string") {
			if (!DATE_CARDS.hasOwnProperty(card))
				throw new Error(`Cannot resolve card: '${card}' is not a known card template`);

			card = DATE_CARDS[card];
		}

		if (!isObject(card))
			throw new Error("Cannot resolve card: dial must be a string or object");

		if (!card.name || typeof card.name != "string")
			throw new TypeError("Cannot resolve card: no valid name provided");

		if (nameMap.hasOwnProperty(card.name))
			throw new Error(`Cannot resolve card: card by name '${card.name}' already defined`);
		nameMap[card.name] = true;

		if (DATE_CARDS.hasOwnProperty(card.name))
			card = inject(card, DATE_CARDS[card.name], "cloneTarget");

		outCards.push(card);
	};

	if (Array.isArray(cards)) {
		for (let i = 0, l = cards.length; i < l; i++)
			resolve(cards[i]);
	} else if (isObject(cards)) {
		for (let i = 0, l = CARD_ORDER.length; i < l; i++) {
			const name = CARD_ORDER[i];

			if (!cards.hasOwnProperty(name))
				continue;

			if (isObject(cards[name])) {
				resolve(Object.assign({
					name
				}, cards[name]));
			} else
				resolve(cards[name]);
		}
	}

	return outCards;
}

export {
	DATE_CARDS
};
