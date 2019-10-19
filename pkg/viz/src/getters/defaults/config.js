function get(config, assets, r) {
	return {
		style: {
			axes: {
				font: "20px Arial",
				lines: "#666",
				col1: "#777",
				col2: "#ccc"
			},
			candle: {
				wick: "#a4b9c5",
				positive: "#14b32a",
				negative: "#b73230",
				width: 3
			},
			candleHollow: {
				positive: "#14b32a",
				negative: "#b73230",
				width: 3
			},
			bar: {
				stroke: "#2d88ce",
				width: 2
			},
			barColored: {
				width: 2,
				positive: "#14b32a",
				negative: "#b73230"
			},
			overview: {
				fill: "#3094d4",
				stroke: "transparent",
				width: 2
			},
			grid: {
				col1: "#ddd",
				col2: "#e5e5e5"
			},
			line: {
				stroke: "#2d88ce",
				width: 4
			},
			lineColored: {
				width: 4,
				positive: "#14b32a",
				negative: "#b73230"
			},
			mountain: {
				fill: ["#7bbae2", "#edf7ff"]
			},
			mountainLine: {
				stroke: "#2d88ce",
				width: 4,
				fill: ["rgba(123,186,226,0.5)", "rgba(237,247,255,0.5)"]
			},
			lines: {
				width: 2,
				thickWidth: 4,
				background: "#2e87ce",
				main: "black",
				overlay: "#666"
			},
			boll: {
				fill: "rgba(0,0,0,0.1)",
				stroke: "rgba(0,0,0,0.4)",
				strokeInner: "rgba(0,0,0,0.2)",
				width: 2,
				widthInner: 3
			},
			kdj: {
				width: 2,
				k: "#b73230",
				d: "#14b32a",
				j: "#3076d4"
			},
			rsi6: {
				width: 2,
				stroke: "black"
			},
			rsi12: {
				width: 2,
				stroke: "black"
			},
			trix: {
				width: 2,
				stroke: "black"
			},
			volume: {
				positive: "rgba(50, 255, 50, 0.15)",
				negative: "rgba(255, 50, 50, 0.15)"
			},
			standardLine: {
				width: 2,
				stroke: "black"
			},
			successive: {
				0: "#cfeaff",
				1: "#76c2fd",
				2: "#2d88ce",
				3: "#0c5792",
				4: "#0b8074",
				5: "#29b7a9",
				6: "#62ecdf",
				width: 2
			},
			assets: {
				primary: {
					stroke: "#139cff",
					width: 4
				},
				secondary: {
					// stroke: "#6be06b",
					stroke: "#a5f9a5",
					width: 2
				},
				tertiary: {
					stroke: "#9898f9",
					width: 2
				}
			},
			trades: {
				buy: {
					stroke: "#28824e",
					width: 2
				},
				sell: {
					stroke: "#286f82",
					width: 2
				}
			}
		},
		styleAlt: {
			candle: {
				wick: "#295263"
			},
			bar: {
				stroke: "#2d88ce"
			},
			overview: {
				// fill: "#164884"
				fill: "#1262c1"
			},
			grid: {
				col1: "#333",
				col2: "#444"
			},
			line: {
				stroke: "#2d88ce",
				width: 4
			},
			mountain: {
				fill: ["rgba(37,136,189,0.8)", "rgba(7,31,60,0.8)"]
			},
			mountainLine: {
				stroke: "#2d88ce",
				width: 4,
				fill: ["rgba(37,136,189,0.6)", "rgba(7,31,60,0.6)"]
			},
			lines: {
				main: "white",
				overlay: "#888"
			},
			boll: {
				fill: "rgba(255,255,255,0.1)",
				stroke: "rgba(255,255,255,0.7)",
				strokeInner: "rgba(255,255,255,0.4)"
			},
			rsi6: {
				stroke: "white"
			},
			rsi12: {
				stroke: "white"
			},
			trix: {
				stroke: "white"
			},
			standardLine: {
				stroke: "white"
			}
		},
		dynamicSizeW: true,
		dynamicSizeH: true,
		tracking: "none",	// none - do nothing, fill - fill entire draw area at all times
		canvRes: 2,
		moduleCallOrder: {
			default: ["graph", "xAxis", "yAxis"]
		},
		performance: {
			unmonitoredCount: 0,
			throttlingEnabled: true,
			throttleSampling: 2
		},
		warnings: {
			axes: {
				infiniteSpan: false,
				illegalGraduationMode: true
			}
		}
	};
}

export default {
	get,
	cachePolicy: "none"
};
