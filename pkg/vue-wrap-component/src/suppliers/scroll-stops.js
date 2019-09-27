import { resolveArgs } from "@qtxr/utils";

const scrollStopsParams = [
	{ name: "name", type: "string", default: "scrollStops" },
	{ name: "options", type: "object", default: {} }
];

export default {
	init(ScrollStops) {
		return (wrapper, used, ...args) => {
			const {
				name,
				options
			} = resolveArgs(args, scrollStopsParams);
		
			// Prep data object for reactivity
			wrapper.addData(name, null);
		
			wrapper.addHook((options.on || "beforeMount"), function() {
				const elem = options.element;
				options.elem = typeof elem == "function" ? elem.call(this, elem) : elem;
				this.$data[name] = new ScrollStops(options);
				this.$data[name].thisVal = this;
			});
		
			wrapper.addHook((options.off || "beforeDestroy"), function() {
				this.$data[name].destroy();
			});
		};
	}
};
