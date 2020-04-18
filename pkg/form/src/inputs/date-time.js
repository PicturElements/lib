import {
	isObject,
	isFiniteNum
} from "@qtxr/utils";
import Input, { INJECT } from "./input";
import resolveCards from "../assets/date-cards";
import resolveDials from "../assets/dials";

export default class DateTime extends Input {
	constructor(name, options, form) {
		super(name, options, form, {
			meridiem: "boolean",
			range: "boolean",
			cards: "Array|Object",
			dials: "Array|Object",
			dayLabels: "Array|function",
			monthLabels: "Array|function",
			rangeSeparator: "string",
			minDate: "Date|string|number",
			maxDate: "Date|string|number"
		});

		Object.assign(this, resolveCards(this.cards));
		Object.assign(this, resolveDials(this.dials));
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

DateTime.formalize
	.if("number")
		.as("number")
		.to(getDateTimeData)
		.from(d => dateTimeDataToDate(d).getTime())
	.if("string")
		.as("string")
		.to(getDateTimeData)
		.from(d => dateTimeDataToDate(d).toUTCString())
	.if(Date)
		.as("date")
		.to(getDateTimeData)
		.from(dateTimeDataToDate)
	.if(Object)
		.as("object")
		.to(d => normalizeDateData(Object.assign({
			year: null,
			month: null,
			day: null
		}, d)))
	.else
		.to(_ => getDateTimeData(null))
		.from(d => dateTimeDataToDate(d, true));

function getDateTimeData(date) {
	const isEmpty = date == null;
	
	date = date instanceof Date ?
		date :
		(isEmpty ? new Date() : new Date(date));

	return normalizeDateData({
		year: date.getFullYear(),
		month: date.getMonth(),
		day: date.getDate(),
		hour: date.getHours(),
		minute: date.getMinutes(),
		second: date.getSeconds(),
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
		d.year = new Date().getFullYear();
		d.yearSet = false;
	} else if (typeof d.yearSet != "boolean")
		d.yearSet = true;

	if (!isFiniteNum(d.month)) {
		d.month = new Date().getFullYear();
		d.monthSet = false;
	} else if (typeof d.monthSet != "boolean")
		d.monthSet = true;

	if (!isFiniteNum(d.day)) {
		d.day = new Date().getFullYear();
		d.daySet = false;
	} else if (typeof d.daySet != "boolean")
		d.daySet = true;

	return d;
}

function dateTimeDataToDate(d, ignoreTimezone = false) {
	if (d.isEmpty)
		return null;

	const tzo = ignoreTimezone ? 0 : (d.tzo || 0);

	return new Date(
		d.year || 0,
		d.month || 0,
		d.day || 0,
		d.hour || 0,
		(d.minute || 0 - tzo),
		d.second || 0
	);
}
