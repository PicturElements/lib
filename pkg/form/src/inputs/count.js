import Input from "./input";

export default class Count extends Input {
	constructor(name, options, form) {
		super(name, options, form, {
			min: "number",
			max: "number",
			step: "number",
			ticks: "Array|function"
		});
	}
}
