import BaseInput, { INJECT } from "./base-input";
import resolveCards from "../assets/date-cards";

const NativeDate = window.Date,
	getDateData = date => {
		if (!date) {
			return {
				year: null,
				month: null,
				date: null
			};
		}

		date = date instanceof NativeDate ? date : new NativeDate(date);

		return {
			year: date.getFullYear(),
			month: date.getMonth(),
			date: date.getDate()
		};
	},
	dateDataToDate = d => {
		return new NativeDate(d.year || 0, d.month || 0, d.date || 0);
	};

export default class Date extends BaseInput {
	constructor(name, options, form) {
		super(name, options, form, {
			range: "boolean",
			cards: "Array|Object",
			dayLabels: Array
		});

		this.cards = resolveCards(this.cards);
	}

	[INJECT](value) {
		if (typeof this.handlers.inject == "function")
			return super[INJECT](value);

		return this.vt(value);
	}
}

Date.formalize
	.if("string")
		.to(getDateData)
		.from(d => dateDataToDate(d).toUTCString());
