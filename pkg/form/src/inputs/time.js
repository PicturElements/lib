import Input, { INJECT } from "./input";
import resolveDials from "../assets/dials";

export default class Time extends Input {
	constructor(name, options, form) {
		super(name, options, form, {
			meridiem: "boolean",
			range: "boolean",
			dials: "Array|Object|function",
			ampmLabels: "Array|function",
			rangeSeparator: "string|function",
			timeSeparator: "string|function",
			placeholderChar: "string|function",
			geometricHands: "boolean"
		});

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

Time.formalize
	.if(d => typeof d == "number" && d > (24 * 60 * 60))
		.as("timestamp")
		.to(getTimeData)
		.from((d, f) => timeDataToDate(d, f.sourceData).getTime())
	.if("number")
		.as("seconds")
		.to(d => getTimeData(getDayStartDate().getTime() + d * 1000))
		.from((d, f) => (d.hour || 0) * 3600 + (d.minute || 0) * 60 + (d.second || 0))
	.if("string")
		.as("string")
		.to(getTimeData)
		.from((d, f) => timeDataToDate(d, f.sourceData).toUTCString())
	.if(Date)
		.as("date")
		.to(getTimeData)
		.from((d, f) => timeDataToDate(d, f.sourceData))
	.if(Object)
		.as("object")
		.to(d => Object.assign({
			hour: null,
			minute: null,
			second: null
		}, d))
	.else
		.to(_ => getTimeData(null))
		.from((d, f) => {
			if (d.hour == null && d.minute == null && d.second == null)
				return null;

			return timeDataToDate(d, f.sourceData);
		});

function getTimeData(date) {
	if (date == null) {
		return {
			hour: null,
			minute: null,
			second: null
		};
	}

	date = date instanceof Date ? date : new Date(date);

	return {
		hour: date.getHours(),
		minute: date.getMinutes(),
		second: date.getSeconds()
	};
}

function timeDataToDate(d, day) {
	const dayDate = getDayStartDate(day);
	return new Date(
		dayDate.getFullYear(),
		dayDate.getMonth(),
		dayDate.getDate(),
		d.hour || 0,
		d.minute || 0,
		d.second || 0
	);
}

function getDayStartDate(date) {
	date = date instanceof Date ? date : (date == null ? new Date() : new Date(date));
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
