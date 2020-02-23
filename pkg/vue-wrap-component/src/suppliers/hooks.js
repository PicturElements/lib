export default {
	init(Hookable) {
		return ({ wrapper, used, storage }, name = "hooks") => {
			const hook = new Hookable();
			wrapper.addData(name, hook);
			storage.push(name, hook);

			if (used)
				return;

			wrapper.addHook("beforeDestroy", _ => {
				storage.forEach(h => h.clearHooks());
			});
		};
	}
};
