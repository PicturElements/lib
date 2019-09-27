export default {
	init(Debouncer) {
		return (wrapper, used, name, timeout = 50) => {
			const int = wrapper.internal;
	
			int.debounce = int.debounce || {};
			int.debounce[name] = new Debouncer(timeout);
	
			wrapper.addData(name, int.debounce[name]);
	
			if (used)
				return;
			
			wrapper.addHook("beforeDestroy", _ => {
				for (const k in int.debounce) {
					if (int.debounce.hasOwnProperty(k))
						int.debounce[k].clear();
				}
			});
		};
	}
};
