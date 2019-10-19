import Axis from "../../engine/modules/axis";
import Instantiator from "../../utilities/instantiator";

function get() {
	return {
		axes: {
			time: new Instantiator(Axis, "time", "<<owner>>", "<<owner.config.warnings.axes>>"),
			linear: new Instantiator(Axis, "linear", "<<owner>>", "<<owner.config.warnings.axes>>")
		},
		easings: {
			easeInOut: "ease-in-out",
			linear: "linear"
		}
	};
}

export default {
	get,
	cachePolicy: "none"
};
