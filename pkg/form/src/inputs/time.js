import BaseInput, {
	INJECT,
	EXTRACT,
	SELF_EXTRACT
} from "./base-input";
import resolveDials from "../assets/dials";
import { Formalizer } from "@qtxr/uc";

const secondsInDay = 24 * 60 * 60,
	dateToSeconds = date => {
		date = date instanceof Date ? date : (date == null ? new Date() : new Date(date));
		return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
	},
	getDayStart = date => {
		date = date instanceof Date ? date : (date == null ? new Date() : new Date(date));
		return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
	},
	formalizer = new Formalizer()
		.if(d => typeof d == "number" && d > secondsInDay)
			.to(dateToSeconds)
			.from((d, f) => {
				return getDayStart(f.sourceData) + d * 1000;
			})
		.if("number")
			.to(d => d)
			.from(d => d)
		.if("string")
			.to(dateToSeconds)
			.from(d => {
				const timestamp = getDayStart();
				return new Date(timestamp + d * 1000).toUTCString();
			})
		.if(Object)
			.to(d => {
				const hours = d.h || d.hours || 0,
					minutes = d.m || d.minutes || 0,
					seconds = d.s || d.seconds || 0;

				return (hours * 3600 + minutes * 60 + seconds) % secondsInDay;
			})
			.from((d, f) => {
				const sd = f.sourceData,
					outData = {},
					hourKey = sd.hasOwnProperty("h") ? "h" : "hours",
					minKey = sd.hasOwnProperty("m") ? "m" : "minutes",
					secKey = sd.hasOwnProperty("s") ? "s" : "seconds";

				outData[hourKey] = Math.floor(d / 3600);
				outData[minKey] = Math.floor(d / 60) % 60;
				outData[secKey] = d % 60;

				return outData;
			})
		.else
			.to(d => null)
			.from(d => d);

export default class Time extends BaseInput {
	constructor(name, options, form) {
		super(name, options, form, {
			meridiem: "boolean",
			range: "boolean",
			dials: "Array|Object",
			ampmLabels: Array,
			rangeSeparator: "string",
			timeSeparator: "string",
			placeholderChar: "string",
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
				return value.map(d => formalizer.transform(d));

			value = formalizer.transform(value);

			return [value, value];
		} else {
			if (Array.isArray(value))
				return formalizer.transform(value[0]);
			
			return formalizer.transform(value);
		}
	}

	[EXTRACT]() {
		return this[SELF_EXTRACT](this.value.transform());
	}
}
