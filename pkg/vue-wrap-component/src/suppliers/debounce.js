export default {
	use(wrapper, used, name, timeout = 50) {
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
	}
};

class Debouncer extends Hookable {
	constructor(timeout) {
		super();
		this.timeout = timeout;
		this.timer = null;
		this.callback = null;
	}

	debounce(callback, timeout) {
		this.callback = callback;
		this.clear();
		const to = typeof timeout == "number" ? timeout : this.timeout;
		this.timer = setTimeout(callback, to);
	}

	clear() {
		clearTimeout(this.timer);
	}
}
