import {
	hasOwn,
	filterMut,
	resolveArgs
} from "@qtxr/utils";
import * as m from "@qtxr/utils/src/math";
import { isGrammarNode } from "./";
import { processDateFormatter } from "./custom-grammars";

const datePeriods = {
	year: 31557600,
	month: 2628000,
	day: 86400,
	hour: 3600,
	minute: 60,
	second: 1,
};

const langStdLib = {
	day(a, accessor) {		// Suggested accessor: day
		const data = a.manager.get(accessor) || [];
		return data[a.store.date.getDay()];
	},
	month(a, accessor) {	// Suggested accessor: month
		const data = a.manager.get(accessor) || [];
		return data[a.store.date.getMonth()];
	},
	ampm(a, accessor) {		// Suggested accessor: meridiem
		const data = a.manager.get(accessor) || ["AM", "PM"];
		return data[Math.floor(a.store.date.getHours() / 12)];
	},
	meridiem(a) {
		return a.store.ampm(a);
	},
	m12(a, formatter, useMeridiem, fallback) {
		useMeridiem = typeof useMeridiem == "boolean" ? useMeridiem : true;

		return processDateFormatter(a.store.date, formatter, (matched, num) => {
			if (!matched || formatter.class != "hour" || !useMeridiem)
				return fallback || formatter;

			return num % 12 || 12;
		});
	},
	round(a, num, accuracy = 2) {
		if (isNaN(Number(num)))
			return num;

		const factor = Math.pow(10, accuracy);
		return Math.round(num * factor) / factor;
	},
	add(a, ...terms) {
		return terms.reduce((total, term) => total + (Number(term) || 0), 0);
	},
	lower(a, str) {
		if (typeof str != "string")
			return str;

		return str.toLowerCase();
	},
	upper(a, str) {
		if (typeof str != "string")
			return str;

		return str.toUpperCase();
	},
	capitalize(a, str) {
		if (typeof str != "string")
			return str;

		return str[0].toUpperCase() + str.substr(1).toLowerCase();
	},
	d(a, ...args) {
		return new Date(...args);
	},
	dateDiff(...args) {
		return this.dateDiffRaw(...args).items
			.map(d => d.value)
			.join("");
	},
	dateDiffRaw(a, ...args) {
		let {
			date,
			cutoff,
			spacing,
			dateItems
		} = resolveArgs(args, [
			{ name: "date", type: Date, required: true },
			{ name: "cutoff", type: "number", default: 2 },
			{ name: "spacing", type: ["string", Array], default: null },
			{ name: "dateItems", type: "any", coalesce: true }
		]);

		const interSpacing = (Array.isArray(spacing) ? spacing[0] : spacing) || "",
			interpolatorSpacing = (Array.isArray(spacing) ? spacing[1] : spacing) || "";

		const itemRef = dateItems.map(value => ({
				value,
				use: false
			})),
			visitOrder = dateItems.map((candidate, i) => {
				let formatter = candidate,
					valueIdx = -1;

				if (Array.isArray(candidate)) {
					for (let j = 0, l = candidate.length; j < l; j++) {
						if (!isGrammarNode(candidate[j], "date-formatter"))
							continue;

						if (valueIdx > -1)
							throw new Error("Cannot reolve multiple date formatters in one interpolator");

						formatter = candidate[j];
						valueIdx = j;
					}
				}

				return isGrammarNode(formatter, "date-formatter") ? {
					valueIdx,
					formatter,
					index: i,
					argument: candidate,
					period: datePeriods[formatter.class]
				} : null;
			})
			.filter(Boolean)
			.sort((d, d2) => d.period > d2.period ? -1 : 1);

		const storeTime = a.store.date.getTime(),
			refTime = date.getTime();
		let diff = Math.floor(Math.abs(storeTime - refTime) / 1000);

		for (let i = 0, l = visitOrder.length; i < l; i++) {
			const d = visitOrder[i],
				count = Math.floor(diff / d.period),
				ref = itemRef[i],
				v = ref.value,
				vArr = Array.isArray(v) ? v : [v];

			if (!count || cutoff-- <= 0)
				continue;

			const value = processDateFormatter(count, d.formatter),
				formattedValue = [];

			for (let j = 0, l2 = vArr.length; j < l2; j++) {
				const refArgs = {
					type: j == d.valueIdx ? "formatted" : "text",
					ref,
					value: value,
					index: j,
					array: vArr,
					length: vArr.length,
					visitOrderItem: visitOrder[i],
					formatter: visitOrder[i].formatter
				};
			
				if (typeof v[j] == "function")
					refArgs.value = v[j](refArgs);

				formattedValue.push(refArgs);
			}

			ref.value = formattedValue;
			diff %= d.period;
			ref.use = true;
		}

		const items = [];
		filterMut(itemRef, v => v.use);

		for (let i = 0, l = itemRef.length; i < l; i++) {
			const ref = itemRef[i],
				v = ref.value,
				vArr = Array.isArray(v) ? v : [v];

			for (let j = 0, l2 = vArr.length; j < l2; j++) {
				const refArgs = vArr[j];

				items.push({
					type: refArgs.type,
					value: refArgs.value,
					index: j,
					length: l2
				});

				if (j < l2 - 1) {
					const spacingArgs = {
						type: "interpolatorSpacing",
						value: interpolatorSpacing,
						index: j,
						length: l2 - 1
					};

					if (typeof interpolatorSpacing == "function")
						spacingArgs.value = interpolatorSpacing(spacingArgs);

					items.push(spacingArgs);
				}
			}

			if (i < l - 1) {
				const spacingArgs = {
					type: "spacing",
					value: interSpacing,
					index: i,
					length: l - 1
				};

				if (typeof interSpacing == "function")
					spacingArgs.value = interSpacing(spacingArgs);

				items.push(spacingArgs);
			}
		}

		return {
			date,
			cutoff,
			spacing,
			dateItems,
			interSpacing,
			interpolatorSpacing,
			items,
			diff,
			refTime,
			storeTime,
			future: refTime > storeTime
		};
	},
	console: {
		log(a, ...args) {
			console.log(...args);
		},
		info(a, ...args) {
			console.info(...args);
		},
		warn(a, ...args) {
			console.warn(...args);
		},
		error(a, ...args) {
			console.error(...args);
		}
	},
	get dateString() {
		const date = this.date || new Date();
		return date.toDateString();
	}
};

(_ => {
	for (let k in m) {
		if (hasOwn(m, k))
			langStdLib[k] = (a, ...args) => m[k](...args);
	}
})();

export default langStdLib;
