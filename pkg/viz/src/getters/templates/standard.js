function get(config, assets, r) {
	return `
		@xAxis
			.viz-horizontal : xAxis
				canvas.viz-hor-scale : xCanv

		@yAxis
			.viz-vertical : yAxis
				canvas.viz-vert-scale : yCanv

		@overview
			.viz-overview : overview
				canvas.viz-overview-canvas : overviewCanv
				div.viz-overview-mask : overviewMask

		@legend
			.viz-legend : legend
				div.viz-legend-main : mainLegend
				div.viz-legend-secondary : secondaryLegend

		.viz-wrapper : wrapper
			@legend(legend.orientation="top")
			@overview(overview.orientation="top")
			.viz-graph-module
				@xAxis(xAxis.orientation="top")
				.viz-graph-box : graphBox
				@xAxis(xAxis.orientation="bottom")
				.viz-pointer(pointer) : pointer
				.viz-graph-overlay(overlay) : overlay
				.viz-graph-overlay.top-overlay(overlay) : topOverlay
			@legend(legend.orientation="bottom")
			@overview(overview.orientation="bottom")
			.viz-loader-wrapper(loader) : loader
	`;
}

export default {
	get,
	cachePolicy: "permanent"
};
