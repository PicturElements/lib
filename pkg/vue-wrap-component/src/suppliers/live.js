import { inject } from "@qtxr/utils";

export default {
	use(wrapper, used, data) {
		if (!used)
			wrapper.internal.live = {};
	
		inject(wrapper.internal.live, data, {
			override: true,
			injectSymbols: true,
			shallow: true
		});
	}
};
