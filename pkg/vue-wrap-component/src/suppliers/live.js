import { inject } from "@qtxr/utils";

export default {
	use(wrapper, used, computeds) {
		if (!used)
			wrapper.internal.live = {};

		Object.assign(wrapper.internal.live, computeds);
	}
};
