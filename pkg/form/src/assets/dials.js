import {
	inject,
	isObject,
	resolveVal
} from "@qtxr/utils";

const DIALS = {
	hour: {
		name: "hour",
		accessor: "hour",
		defaultDial: false,
		extent: 24,
		displayExtent: inp => inp.meridiem ? 12 : 24,
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
	minute: {
		name: "minute",
		accessor: "minute",
		defaultDial: false,
		extent: 60,
		displayExtent: 60,
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
	second: {
		name: "second",
		accessor: "second",
		defaultDial: false,
		extent: 60,
		displayExtent: 60,
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

const DIAL_ORDER = ["hour", "minute", "second"],
	DEFAULT_DIALS = ["hour", "minute"],
	RESULT_DIAL_NAME = "result";

export default function resolveDials(dials = DEFAULT_DIALS) {
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

export {
	DIALS
};
