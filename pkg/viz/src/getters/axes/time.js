import { padStart } from "@qtxr/utils";

const style = {
	line: "col1" 
};

const style2 = {
	line: "col2"
};

function get(config, assets, r) {
	return {
		name: "time",
		type: "template",
		start: new Date(config.startYear, 0).getTime(),
		end: new Date(config.endYear + 1, 0).getTime(),
		showMap: [0, 1, 2],
		style: r("style").as(Object).or(style),
		get() {
			const years = range(config.startYear, config.endYear);

			return years.map(y => {
				return {
					marking: new Date(y, 0).getTime(),
					label: y,
					args: {
						year: y
					}
				};
			});
		},
		subs: [{
			type: "generator",
			showMap: [1, 2, 3],
			style: r("style").as(Object).or(style2),
			get(args) {
				const span = args.span;
				let spn = 6;

				if (span < 3e7)
					spn = 1;
				else if (span < 8e7)
					spn = 3;

				const monthRange = range(0, Math.floor(11 / spn)),
					months = args.i18n.get(config.i18nMonthAccessor);

				return monthRange.map((m, i) => {
					m *= spn;

					return {
						marking: new Date(args.year, m).getTime(),
						label: months[m],
						args: {
							month: m
						}
					};
				});
			},
			subs: [{
				// This is only needed because of DST, which slightly alters month length.
				// Therefore, it's not possible to infer data points from reference points and spans.
				type: "generator",
				showMap: [2, 3, 4],
				style: r("style").as(Object).or(style),
				get(args, zoom) {
					const span = args.span;
					let spn = 14;

					if (span < 3e6)
						spn = 1;
					else if (span < 1.5e7)
						spn = 7;

					const daysInMonth = new Date(args.year, args.month + 1, 0).getDate(),
						sub = span > 1.5e7 || (span > 4e6 && (daysInMonth < 31 || args.month == 11)) ? 1 : 0,
						days = range(1, Math.floor(31 / spn) - sub);

					return days.map((d, i) => {
						d *= spn;
						return {
							marking: new Date(args.year, args.month, d).getTime(),
							label: zoom == 2 ? d : (d + "/" + (args.month + 1)),
							args: {
								day: d
							}
						};
					});
				},
				subs: [{
					type: "implication",
					position: "relative",
					start: 0,
					span: 60 * 60 * 1000,
					showMap: [3, 4],
					getSpan(args) {
						args.hour = 0;
						const span = args.span;

						if (span < 5e4) return 3600000; // 1h
						if (span < 2e5) return 10800000; // 3h
						if (span < 5e5) return 21600000; // 6h

						return 43200000; // 12h
					},
					get(val, args) {
						args.hour = new Date(val).getHours();
						return args.hour + ":00";
					},
					style: r("style").as(Object).or(style2),
					subs: [{
						type: "implication",
						position: "relative",
						start: 0,
						span: 60 * 1000,
						showMap: [4],
						getSpan(args) {
							const span = args.span;

							if (span < 1e3) return 60000; // 1m;
							if (span < 6e3) return 300000; // 5m;
							if (span < 1.3e4) return 600000; // 10m
							if (span < 1.3e4) return 900000; // 15m

							return 1800000; // 30m
						},
						get(val, args) {
							return padStart(args.hour || 0, 2, "0") + ":" + padStart(new Date(val).getMinutes() || 0, 2, "0");
						},
						style: r("style").as(Object).or(style2)
					}]
				}]
			}]
		}],
		getZoom(span) {
			if (span < 3e4) return 4;
			if (span < 1e6) return 3;
			if (span < 2e7) return 2;
			if (span < 2.3e8) return 1;

			return 0;
		}
	};
}

function range(start, end) {
	if (end == null) {
		end = start;
		start = 0;
	}

	let out = [];

	for (let i = start; i <= end; i++)
		out.push(i);

	return out;
}

export default {
	get,
	cachePolicy: "same-config",
	config: {
		startYear: new Date().getFullYear() - 10,
		endYear: new Date().getFullYear() + 10,
		i18nMonthAccessor: "viz.time.months"
	}
};
