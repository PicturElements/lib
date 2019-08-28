import {
	isFmt,
	resolveRefCaller,
	processFormatter
} from "./lang";

const datePeriods = {
	year: 31557600,
	month: 2628000,
	day: 86400,
	hour: 3600,
	minute: 60,
	second: 1,
};

const langStdLib = {
	day(args, verbose) {
		if (verbose)
			return this.dayV(args);
		return args.dateStore.days[args.store.date.getDay()];
	},
	dayV(args) {
		return args.dateStore.daysVerbose[args.store.date.getDay()];
	},
	month(args, verbose) {
		if (verbose)
			return this.monthV(args);
		return args.dateStore.months[args.store.date.getMonth()];
	},
	monthV(args) {
		return args.dateStore.monthsVerbose[args.store.date.getMonth()];
	},
	ampm(args) {
		return args.dateStore.meridiem[Math.floor(args.store.date.getHours() / 12)];
	},
	m12(args, formatter) {
		return processFormatter(args, formatter, (matched, num) => {
			if (!matched || formatter.class != "hour" || !args.store.militaryTime)
				return formatter;

			return num % 12 || 12;
		});
	},
	round(args, num, accuracy = 2) {
		if (isNaN(Number(num)))
			return num;

		const factor = Math.pow(10, accuracy);
		return Math.round(num * factor) / factor;
	},
	add(args, ...terms) {
		return terms.reduce((total, term) => total + (Number(term) || 0), 0);
	},
	lower(args, str) {
		if (typeof str != "string")
			return str;

		return str.toLowerCase();
	},
	upper(args, str) {
		if (typeof str != "string")
			return str;

		return str.toUpperCase();
	},
	capitalize(args, str) {
		if (typeof str != "string")
			return str;

		return str[0].toUpperCase() + str.substr(1).toLowerCase();
	},
	d(args, ...dateArgs) {
		return new Date(...dateArgs);
	},
	dateDiff(...args) {
		return this.dateDiffRaw(...args).map(d => d.value);
	},
	dateDiffRaw(args, date, cutoff, spacing, ...dateItems) {
		cutoff = Number(cutoff) || 1;
		date = date instanceof Date ? date : new Date(date);
		spacing = spacing == null ? null : { value: spacing };

		const itemRef = dateItems.map(d => ({
				value: d,
				toDelete: false
			})),
			visitOrder = dateItems.map((candidate, i) => {
				return isFmt(candidate, "formatter") ? {
					index: i,
					period: datePeriods[candidate.class],
					formatter: candidate
				} : null;
			})
			.filter(Boolean)
			.sort((d, d2) => d.period > d2.period ? -1 : 1);

		let diff = Math.floor(Math.abs(args.store.date.getTime() - date.getTime()) / 1000);

		visitOrder.forEach(d => {
			const count = Math.floor(diff / d.period);

			itemRef[d.index].isDateItem = true;

			if (count && cutoff-- > 0) {
				const formatted = processFormatter(args, d.formatter, count),
					wordData = resolveRefCaller(args.store, "utils.formatterAnnotation", args, formatted, count, d.formatter);

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
	log(args, ...text) {
		console.log(...text);
	},
	processFormatter
};

export default langStdLib;
