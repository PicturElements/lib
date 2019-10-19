function get(config, assets, r) {
	return `
		@xAxis
			div.viz-horizontal : xAxis
				canvas.viz-hor-scale : xCanv

		@yAxis
			div.viz-vertical : yAxis
				canvas.viz-vert-scale : yCanv

		@overview
			div.viz-overview : overview
				canvas.viz-overview-canvas : overviewCanv
				div.viz-overview-mask : overviewMask

		@legend
			div.viz-legend : legend
				div.viz-legend-main : mainLegend
				div.viz-legend-secondary : secondaryLegend

		div.viz-wrapper : wrapper
			@legend(legend.orientation="top")
			@overview(overview.orientation="top")
			div.viz-graph-module
				@xAxis(xAxis.orientation="top")
				div.viz-graph-box : graphBox
				@xAxis(xAxis.orientation="bottom")
				div.viz-pointer(pointer) : pointer
				div.viz-graph-overlay(overlay) : overlay
				div.viz-graph-overlay.top-overlay(overlay) : topOverlay
			@legend(legend.orientation="bottom")
			@overview(overview.orientation="bottom")
			div.viz-loader-wrapper(loader) : loader
	`;
}

export default {
	get,
	cachePolicy: "permanent"
};
