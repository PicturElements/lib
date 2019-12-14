import BaseInput from "./base-input";

export default class Count extends BaseInput {
	constructor(name, options, form) {
		super(name, options, form, {
			min: "number",
			max: "number",
			step: "number",
			ticks: Array,
			compact: "boolean"
		});
	}
}
