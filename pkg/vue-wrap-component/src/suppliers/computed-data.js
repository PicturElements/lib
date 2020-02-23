import { forEach } from "@qtxr/utils";

export default {
	use({ wrapper, used, storage }, computeds) {
		forEach(computeds, (v, k) => {
			storage.push(k, v);
		}, "overSymbols");
	},
	export: {
		data(args) {
			const data = args.storage.extract();
			
			forEach(data, (v, k) => {
				args.out[k] = v(args.wrapper, args.vm, args);
			});
		}
	}
};
