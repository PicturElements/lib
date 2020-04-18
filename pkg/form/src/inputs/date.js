import {
	isObject,
	isFiniteNum
} from "@qtxr/utils";
import Input, { INJECT } from "./input";
import resolveCards from "../assets/date-cards";

const NativeDate = window.Date;

export default class Date extends Input {
	constructor(name, options, form) {
		super(name, options, form, {
			range: "boolean",
			cards: "Array|Object",
			dayLabels: "Array|function",
			monthLabels: "Array|function",
			rangeSeparator: "string",
			minDate: "Date|string|number",
			maxDate: "Date|string|number"
		});

		Object.assign(this, resolveCards(this.cards));
	}

	[INJECT](value) {
		value = typeof this.handlers.inject == "function" ?
			super[INJECT](value) :
			value;

		if (this.range) {
			if (Array.isArray(value))
				return value.map(d => this.vt(d));

			return [this.vt(value), this.vt(value)];
		} else {
			if (Array.isArray(value))
				return this.vt(value[0]);
			
			return this.vt(value);
		}
	}
}

Date.formalize
	.if("number")
		.as("number")
		.to(getDateData)
		.from(d => dateDataToDate(d).getTime())
	.if("string")
		.as("string")
		.to(getDateData)
		.from(d => dateDataToDate(d).toUTCString())
	.if(NativeDate)
		.as("date")
		.to(getDateData)
		.from(dateDataToDate)
	.if(Object)
		.as("object")
		.to(d => normalizeDateData(Object.assign({
			year: null,
			month: null,
			day: null
		}, d)))
	.else
		.to(_ => getDateData(null))
		.from(d => dateDataToDate(d, true));

function getDateData(date) {
	const isEmpty = date == null;
	
	date = date instanceof NativeDate ?
		date :
		(isEmpty ? new NativeDate() : new NativeDate(date));

	return normalizeDateData({
		year: date.getFullYear(),
		month: date.getMonth(),
		day: date.getDate(),
		tzo: date.getTimezoneOffset(),
		yearSet: !isEmpty,
		monthSet: !isEmpty,
		daySet: !isEmpty
	});
}

function normalizeDateData(d) {
	if (!isObject(d))
		return d;

	if (!isFiniteNum(d.year)) {
		d.year = new NativeDate().getFullYear();
		d.yearSet = false;
	} else if (typeof d.yearSet != "boolean")
		d.yearSet = true;

	if (!isFiniteNum(d.month)) {
		d.month = new NativeDate().getFullYear();
		d.monthSet = false;
	} else if (typeof d.monthSet != "boolean")
		d.monthSet = true;

	if (!isFiniteNum(d.day)) {
		d.day = new NativeDate().getFullYear();
		d.daySet = false;
	} else if (typeof d.daySet != "boolean")
		d.daySet = true;

	return d;
}

function dateDataToDate(d, ignoreTimezone = false) {
	if (d.isEmpty)
		return null;

	const tzo = ignoreTimezone ? 0 : (d.tzo || 0);

	return new NativeDate(d.year || 0, d.month || 0, d.day || 0, 0, -tzo);
}
