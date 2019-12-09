import BaseInput, { INJECT } from "./base-input";
import {
	inject,
	isObject,
	resolveVal
} from "@qtxr/utils";

const DIALS = {
	hours: {
		name: "hours",
		extent: 24,
		displayExtent: inp => inp.meridiem ? 12 : 24,
		multiplier: 3600,
		getValueFromTimestamp: null,
		toPerc: null,
		toVal: null,
		delimitations: 12,
		resolution: 1,
		tickResolution: 1,
		display: (inp, val, runtime) => inp.meridiem ? (val % 12 || 12) : val,
		minDisplayLength: (inp, runtime) => inp.meridiem ? 1 : 2,
		modifyDisplay(inp, val, runtime) {
			const labels = resolveVal(inp.ampmLabels, inp) || ["AM", "PM"];
			runtime.meridiem = labels[Math.floor(val / 12)];
		},
		shortActions: {
			visible: (inp, val, dd) => inp.meridiem,
			buttons: [
				{
					label: (inp, val, dd) => (resolveVal(inp.ampmLabels, inp) || ["AM"])[0],
					class: (inp, val, dd) => val < 12 ? "active" : null,
					action: (inp, val, dd) => dd.setValue(val % 12)
				},
				{
					label: (inp, val, dd) => (resolveVal(inp.ampmLabels, inp) || [null, "PM"])[1],
					class: (inp, val, dd) => val < 12 ? null : "active",
					action: (inp, val, dd) => dd.setValue(12 + val % 12)
				}
			]
		},
		displayDelimiter: null,
		hand: {
			length: 0.7,
			width: 1.2,
			opacity: 1,
			geometric: true
		}
	},
	minutes: {
		name: "minutes",
		extent: 60,
		displayExtent: 60,
		multiplier: 60,
		getValueFromTimestamp: null,
		delimitations: 12,
		resolution: 5,
		tickResolution: 5,
		display: null,
		minDisplayLength: inp => inp.meridiem ? 1 : 2,
		modifyDisplay: null,
		displayDelimiter: null,
		hand: {
			length: 0.95,
			width: 1.2,
			opacity: 0.7,
			geometric: true
		}
	},
	seconds: {
		name: "seconds",
		extent: 60,
		displayExtent: 60,
		multiplier: 1,
		getValueFromTimestamp: null,
		delimitations: 12,
		resolution: 5,
		tickResolution: 5,
		display: null,
		minDisplayLength: inp => inp.meridiem ? 1 : 2,
		modifyDisplay: null,
		displayDelimiter: null,
		hand: {
			length: 1,
			width: 0.7,
			opacity: 0.5,
			geometric: true
		}
	}
};

const DIAL_ORDER = ["hours", "minutes", "seconds"],
	DEFAULT_DIALS = ["hours", "minutes"],
	RESULT_DIAL_NAME = "result";

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

		if (!this.dials)
			this.dials = DEFAULT_DIALS;

		Object.assign(this, resolveDials(this.dials));
	}

	[INJECT](value) {
		if (typeof this.handlers.inject == "function")
			return super[INJECT](value);

		if (this.range) {
			if (Array.isArray(value))
				return value.map(coerceToDaySeconds);

			value = coerceToDaySeconds(value);

			return [value, value];
		} else {
			if (Array.isArray(value))
				return coerceToDaySeconds(value[0]);
			
			return coerceToDaySeconds(value);
		}
	}
}

function coerceToDaySeconds(data) {
	const secondsInDay = 24 * 60 * 60;

	switch (typeof data) {
		case "number":
			if (data <= secondsInDay)
				return data;

			data = new Date(data);
			break;
		
		case "string":
			data = new Date(data);
			break;

		case "object": {
			if (!isObject(data))
				break;

			const hours = data.h || data.hours || 0,
				minutes = data.m || data.minutes || 0,
				seconds = data.s || data.seconds || 0;

			return (hours * 3600 + minutes * 60 + seconds) % secondsInDay;
		}
	}

	switch (data && data.constructor) {
		case Date:
			return data.getHours() * 3600 + data.getMinutes() * 60 + data.getSeconds();
	}

	return null;
}

function resolveDials(dials) {
	const outDials = [],
		nameMap = {};
	let resultDial = null;

	const resolve = dial => {
		if (typeof dial == "string") {
			if (!DIALS.hasOwnProperty(dial))
				throw new Error(`Cannot resolve dial: '${dial}' is not a known dial template`);

			dial = DIALS[dial];
		}

		if (!isObject(dial))
			throw new Error("Cannot resolve dial: dial must be a string or object");

		if (!dial.name || typeof dial.name != "string")
			throw new TypeError("Cannot resolve dial: no valid name provided");

		if (nameMap.hasOwnProperty(dial.name))
			throw new Error(`Cannot resolve dial: dial by name '${dial.name}' already defined`);
		nameMap[dial.name] = true;

		if (dial.name == RESULT_DIAL_NAME || (dial.isResultDial && !resultDial)) {
			resultDial = dial;
			return;
		}

		if (DIALS.hasOwnProperty(dial.name))
			dial = inject(dial, DIALS[dial.name], "cloneTarget");

		outDials.push(dial);
	};

	if (Array.isArray(dials)) {
		for (let i = 0, l = dials.length; i < l; i++)
			resolve(dials[i]);
	} else if (isObject(dials)) {
		for (let i = 0, l = DIAL_ORDER.length; i < l; i++) {
			const name = DIAL_ORDER[i];

			if (!dials.hasOwnProperty(name))
				continue;

			if (isObject(dials[name])) {
				resolve(Object.assign({
					name
				}, dials[name]));
			} else
				resolve(dials[name]);
		}
	}

	if (!resultDial)
		resultDial = outDials[0];

	return {
		dials: outDials,
		resultDial: inject({
			name: RESULT_DIAL_NAME
		}, resultDial)
	};
}
