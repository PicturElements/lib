import {
	isToken,
	resolveRefCaller,
	processFormatter
} from "./lang";
import * as m from "@qtxr/utils/src/math";

const datePeriods = {
	year: 31557600,
	month: 2628000,
	day: 86400,
	hour: 3600,
	minute: 60,
	second: 1,
};

const langStdLib = {
	day(a, accessor) {	// Suggested key: day
		const data = a.manager.get(accessor) || [];
		return data[a.store.date.getDay()];
	},
	month(a, accessor) {	// Suggested key: month
		const data = a.manager.get(accessor) || [];
		return data[a.store.date.getMonth()];
	},
	ampm(a, accessor) {	// Suggested key: meridiem
		const data = a.manager.get(accessor) || [];
		return data[Math.floor(a.store.date.getHours() / 12)];
	},
	meridiem(a) {
		return a.store.ampm(a);
	},
	m12(a, formatter, useMeridiem, fallback) {
		useMeridiem = typeof useMeridiem == "boolean" ? useMeridiem : true;

		return processFormatter(a, formatter, (matched, num) => {
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
		return this.dateDiffRaw(...args).map(d => d.value);
	},
	dateDiffRaw(a, date, cutoff, spacing, ...dateItems) {
		cutoff = Number(cutoff) || 1;
		date = date instanceof Date ? date : new Date(date);
		spacing = spacing == null ? null : { value: spacing };

		const itemRef = dateItems.map(d => ({
				value: d,
				toDelete: false
			})),
			visitOrder = dateItems.map((candidate, i) => {
				return isToken(candidate, "formatter") ? {
					index: i,
					period: datePeriods[candidate.class],
					formatter: candidate
				} : null;
			})
			.filter(Boolean)
			.sort((d, d2) => d.period > d2.period ? -1 : 1);

		let diff = Math.floor(Math.abs(a.store.date.getTime() - date.getTime()) / 1000);

		visitOrder.forEach(d => {
			const count = Math.floor(diff / d.period);

			itemRef[d.index].isDateItem = true;

			if (count && cutoff-- > 0) {
				const formatted = processFormatter(a, d.formatter, count),
					wordData = resolveRefCaller(a.store, "utils.formatterAnnotation", a, formatted, count, d.formatter);

				itemRef[d.index].value = wordData.match ? wordData.data : formatted;
				diff %= d.period;
			} else
				itemRef[d.index].toDelete = true;
		});

		for (let i = itemRef.length - 1; i >= 0; i--) {
			const ref = itemRef[i],
				nextRef = itemRef[i + 1];

			if (ref.toDelete)
				itemRef.splice(i, 1);
			else if (spacing && ref.isDateItem && nextRef && nextRef.isDateItem)
				itemRef.splice(i + 1, 0, spacing);
		}

		return itemRef;
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
	processFormatter
};

"abs|acos|acosh|asin|asinh|atan|atanh|atan2|ceil|cbrt|expm1|clz32|cos|cosh|exp|floor|fround|hypot|imul|log|log1p|log2|log10|max|min|pow|random|sign|sin|sinh|sqrt|tan|tanh|trunc".split("|")
	.forEach(name => {
		langStdLib[name] = (a, ...args) => m[name](...args);
	});

export default langStdLib;
