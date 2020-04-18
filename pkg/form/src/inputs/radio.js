import { resolveVal } from "@qtxr/utils";
import Input, { INJECT } from "./input";

export default class Radio extends Input {
	constructor(name, options, form) {
		super(name, options, form, {
			options: "Array|function",
			autoSet: "boolean",
			inject: "function|string"
		});
		this.pendingOptions = null;
		this.finishInit();
	}

	finishInit() {
		super.finishInit();
	}

	[INJECT](value) {
		if (typeof this.handlers.inject == "function")
			return super[INJECT](value);

		return this.resolveOptionSelection({
			value,
			resolve: runtime => resolveVal(this.options, runtime, true)
		});
	}
}
