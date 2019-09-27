export default {
	init(Hookable) {
		return (wrapper, used, name = "hooks") => {
			const int = wrapper.internal;

			int.hooks = int.hooks || [];
			const hooks = wrapper.addData(name, new Hookable());
			int.hooks.push(hooks);

			if (used)
				return;

			wrapper.addHook("mounted", _ => {
				int.hooks.forEach(h => h.clearHooks());
			});
		};
	}
};
