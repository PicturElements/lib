import {
	inject,
	hasOwn,
	isObject,
	resolveVal
} from "@qtxr/utils";

const DIALS = {
	hour: {
		name: "hour",
		accessor: "hour",
		defaultDial: false,
		extent: 24,
		displayExtent: ({ input }) => input.meridiem ? 12 : 24,
		toPerc: null,
		toVal: null,
		delimitations: 12,
		resolution: 1,
		tickResolution: 1,
		display: ({ input }, val, rt) => input.meridiem ? (val % 12 || 12) : val,
		minDisplayLength: ({ input }, rt) => input.meridiem ? 1 : 2,
		modifyDisplay(runtime, val, rt) {
			const labels = resolveVal(runtime.input.ampmLabels, runtime) || ["AM", "PM"];
			rt.meridiem = labels[Math.floor(val / 12)];
		},
		shortActions: {
			visible: ({ input }, val, dd) => input.meridiem,
			buttons: [
				{
					label: (runtime, val, dd) => (resolveVal(runtime.input.ampmLabels, runtime) || ["AM"])[0],
					class: (runtime, val, dd) => val < 12 ? "active" : null,
					action: (runtime, val, dd) => dd.setValue(val % 12)
				},
				{
					label: (runtime, val, dd) => (resolveVal(runtime.input.ampmLabels, runtime) || [null, "PM"])[1],
					class: (runtime, val, dd) => val < 12 ? null : "active",
					action: (runtime, val, dd) => dd.setValue(12 + val % 12)
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
		minDisplayLength: ({ input }) => input.meridiem ? 1 : 2,
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
		minDisplayLength: ({ input }) => input.meridiem ? 1 : 2,
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
			if (!hasOwn(DIALS, dial))
				throw new Error(`Cannot resolve dial: '${dial}' is not a known dial template`);

			dial = DIALS[dial];
		}

		if (!isObject(dial))
			throw new Error("Cannot resolve dial: dial must be a string or object");

		if (!dial.name || typeof dial.name != "string")
			throw new TypeError("Cannot resolve dial: no valid name provided");

		if (hasOwn(nameMap, dial.name))
			throw new Error(`Cannot resolve dial: dial by name '${dial.name}' already defined`);
		nameMap[dial.name] = true;

		if (dial.name == RESULT_DIAL_NAME || (dial.isResultDial && !resultDial)) {
			resultDial = dial;
			return;
		}

		if (hasOwn(DIALS, dial.name))
			dial = inject(dial, DIALS[dial.name], "cloneTarget");

		outDials.push(dial);
	};

	if (Array.isArray(dials)) {
		for (let i = 0, l = dials.length; i < l; i++)
			resolve(dials[i]);
	} else if (isObject(dials)) {
		for (let i = 0, l = DIAL_ORDER.length; i < l; i++) {
			const name = DIAL_ORDER[i];

			if (!hasOwn(dials, name))
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
