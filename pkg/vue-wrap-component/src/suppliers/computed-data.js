import { inject } from "@qtxr/utils";

export default {
	use(wrapper, used, data) {
		if (!used)
			wrapper.internal.computedData = {};
	
		inject(wrapper.internal.computedData, data, {
			override: true,
			injectSymbols: true,
			shallow: true
		});
	}
};
