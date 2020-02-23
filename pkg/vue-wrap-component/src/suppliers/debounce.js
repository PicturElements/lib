export default {
	init(Debouncer) {
		return ({ wrapper, used, storage }, name, timeout = 50) => {
			const debouncer = new Debouncer(timeout);
			wrapper.addData(name, debouncer);
			storage.push(name, debouncer);

			if (used)
				return;
			
			wrapper.addHook("beforeDestroy", _ => {
				storage.forEach(d => d.clear());
			});
		};
	}
};
