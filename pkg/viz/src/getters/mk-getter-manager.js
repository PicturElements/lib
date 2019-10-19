import { GetterManager } from "@qtxr/uc";

// ====== Getters ======
// Axis
import { default as linear } from "./axes/linear";
import { default as time } from "./axes/time";

// Processors
import { default as collectors } from "./processors/collectors";
import { default as labellers } from "./processors/labellers";
import { default as modifiers } from "./processors/modifiers";
import { default as plotters } from "./processors/plotters";

// Default data
import { default as assets } from "./defaults/assets";
import { default as config } from "./defaults/config";
import { default as graphData } from "./defaults/graph-data";

// Templates
import { default as standard } from "./templates/standard";

export default function mkGetterManager() {
	return new GetterManager({
		axes: {
			linear,
			time
		},
		processors: {
			collectors,
			labellers,
			modifiers,
			plotters
		},
		defaults: {
			assets,
			config,
			graphData
		},
		templates: {
			standard
		}
	});
}
