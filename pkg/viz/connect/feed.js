import feed from "../../../runtime/feed";
import * as exp from "../";
import Viz from "../";
import I18NManager from "../../i18n";

feed(exp, "Viz");

feed.add("viz", activeFeed => {
	const i18n = new I18NManager({
		sitemapPath: null
	});

	i18n.feed({
		name: "viz",
		locale: "en",
		data: {
			viz: {
				time: {
					months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
					days: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
					meridiem: ["AM", "PM"],
					dateStr: `[timeAccuracy]
								{$day(viz.time.days), $month(viz.time.months) dd YYYY}
								{$m12(hh):MM $ampm(viz.time.meridiem) - $day(viz.time.days), $month(viz.time.months) dd YYYY}
								{$m12(hh):MM $ampm(viz.time.meridiem) - $day(viz.time.days), $month(viz.time.months) dd YYYY}
								{$m12(hh):MM:SS $ampm(viz.time.meridiem) - $day(viz.time.days), $month(viz.time.months) dd YYYY}`
				}
			}
		}
	});

	const data = [],
		now = Date.now();

	for (let i = 0; i < 15000; i++) {
		data.push({
			x: now + i * 1000000,
			y: Math.sin(i / 5) + Math.sin(i / 10) + Math.sin(i / 20)
		});
	}

	const viz = new Viz(document.querySelector("#content"), {
		config: {
			lockViewport: true
		},
		i18n,
		graphData: {
			standard: {
				template: "standard",
				modules: {
					graph: {
						store: {
							delta: null
						},
						defaults: {
							accessors: {
								snapX: "state.plotIndex.master"
							},
							scale: {
								height: true
							},
							scroll: true,
							crosshair: true,
							labels: {
								vertical: "time",
								horizontal: "linear"
							},
							minHeight: 70,
							maxHeight: 600,
							useOwnBounding: false,
							propagateBounding: {
								minY: true,
								maxY: true
							}
						},
						defaultClone: {
							accessors: {
								dataset: false
							}
						},
						datasets: [
							{
								mode: "own",
								type: "line",
								title: "Test graph",
								id: "master",
								data: [],
								genPlotIndex: true,
								boxLayout: true,
								height: 300,
								minHeight: 200,
								legend: "{{ open | prefix='open: ' | wrap=span }} - {{ close | prefix='close: ' | wrap=span }} - {{ high | prefix='high: ' | wrap=span }} - {{ low | prefix='low: ' | wrap=span }}",
								tooltip: [
									"{{ x | round=2 | prefix='X value: ' | wrap='span.legend-centered-text' }}",
									"{{ y | round=2 | prefix='Y value: ' | wrap='span.legend-centered-text' }}"
								]
							}
						]
					},
					xAxis: true,	// Simply inherit the default value
					yAxis: true,
					tooltip: [],/*{
						global: [
							"{{ x | round=2 | prefix='X value: ' | wrap='span.legend-centered-text' }}",
							"{{ y | round=2 | prefix='Y value: ' | wrap='span.legend-centered-text' }}",
							// {
							// 	template: "{{ y | round=3 |  | wrap-before=span.legend-value }}",
							// 	custom: {
							// 		unitValue(data){
							// 			return data.y;
							// 		}
							// 	}
							// }
						]
					},*/
					overlay: true,
					loader: true
				}
			}
		},
		graphId: "standard"
	});

	viz.setData({
		master: data
	});

	return viz;
});
