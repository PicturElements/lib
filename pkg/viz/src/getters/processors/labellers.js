import {
	get,
	roundToLen
} from "@qtxr/utils";

// Labellers process data from the x and y axis in a graph, as provided by Viz.prototype.addCrosshair function.
// These functions take the Viz instance, closest data point to x/y point, a bounding area object, a percentage
// representation of the given point on the axis, and a value that tells if the point is snapped to the data point.
// A bounding are object contains the following data: min value (0% along the axis), max value (100% along the axis),
// and span value (max-min). This is pertaining to the x or y axis depending on of the function is bound to the
// vertical or horizontal value in a labeller pair.

const getters = {
	time(config, assets, r) {
		return (inst, data, bounding, perc, snapped) => {
			const time = get(data, "data.time"),
				span = bounding.span,
				timestamp = snapped && time ? time : perc * span + bounding.min;
			let timeAccuracy = 0;

			if (span < 172800000)		// < 2 days
				timeAccuracy = 3;
			else if (span < 604800000)	// < 1 week
				timeAccuracy = 2;
			else if (span < 2592000000)	// < 1 month
				timeAccuracy = 1;

			return inst.i18n.dateCompose(config.i18nDateStringAccessor, {
				timestamp,
				timeAccuracy
			}, timestamp);
		};
	},
	linear(config, assets, r) {
		return (inst, data, bounding, perc, snapped) => {
			return roundToLen(bounding.min + perc * bounding.span, 5);
		};
	}
};

export default {
	getters,
	cachePolicy: "same-config",
	config: {
		i18nDateStringAccessor: "viz.time.dateStr"
	}
};
