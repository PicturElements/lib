import { forEach } from "@qtxr/utils"; 

export default {
	use({ storage }, items) {
		forEach(items, (v, k) => {
			storage.push(k, v);
		});
	},
	export: {
		data({ out, storage }) {
			const data = storage.extract();

			forEach(data, (v, k) => {
				out[k] = v;
			});
		}
	}
};
