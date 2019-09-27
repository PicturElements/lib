import { Hookable } from "@qtxr/bc";

export default class Debouncer extends Hookable {
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
