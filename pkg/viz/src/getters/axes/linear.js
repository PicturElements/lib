
const style = {
	line: "col1"
};

const style2 = {
	line: "col2"
};

function get(config, assets, r) {
	return {
		name: "standard",
		type: "implication",
		position: "absolute",
		start: 0,
		getSpan(args) {
			args.hour = 0;
			const span = args.span;

			if (span < 25) return 500;
			if (span < 50) return 1000;
			if (span < 100) return 2000;

			return 5000;
		},
		showMap: [0, 1],
		style: r("style").as(Object).or(style),
		subs: [{
			type: "implication",
			position: "relative",
			start: 0,
			span: 1000,
			showMap: [1, 2],
			style: r("style").as(Object).or(style2),
			subs: [{
				type: "implication",
				position: "relative",
				start: 0,
				getSpan(args) {
					args.hour = 0;
					const span = args.span;

					if (span < 3) return 100;
					if (span < 5) return 200;

					return 500;
				},
				showMap: [2],
				style: r("style").as(Object).or(style),
				subs: [{
					type: "implication",
					position: "relative",
					start: 0,
					getSpan(args) {
						args.hour = 0;
						const span = args.span;

						if (span < 0.000002) return 0.00005;
						if (span < 0.000004) return 0.0001;
						if (span < 0.000006) return 0.000125;
						if (span < 0.000001) return 0.00025;
						if (span < 0.000015) return 0.0005;
						if (span < 0.00003) return 0.001;
						if (span < 0.00005) return 0.00125;
						if (span < 0.0001) return 0.0025;
						if (span < 0.00017) return 0.005;
						if (span < 0.0003) return 0.01;
						if (span < 0.0005) return 0.0125;
						if (span < 0.001) return 0.025;
						if (span < 0.002) return 0.05;
						if (span < 0.004) return 0.1;
						if (span < 0.01) return 0.25;
						if (span < 0.02) return 0.5;
						if (span < 0.05) return 1;
						if (span < 0.1) return 2;
						if (span < 0.2) return 5;
						if (span < 0.5) return 10;
						if (span < 1) return 20;

						return 50;
					},
					showMap: [3],
					style: r("style").as(Object).or(style2)
				}]
			}]
		}],
		getZoom(span) {
			if (span < 2.5) return 3;
			if (span < 12) return 2;
			if (span < 20) return 1;

			return 0;
		}
	};
}

export default {
	get,
	cachePolicy: "same-config",
	config: {}
};
