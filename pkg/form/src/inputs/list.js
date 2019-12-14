import BaseInput, {
	INJECT,
	EXTRACT
} from "./base-input";
import Form from "../form";

export default class List extends BaseInput {
	constructor(name, options, form) {
		super(name, options, form, {
			value: Array,
			formRows: "Array|Object",
			formConfig: "string|Object|Array",
			inheritFormConfig: "boolean",
			rearrangeable: "boolean"
		});
	}

	getRow(data = {}) {
		const formConfig = this.formConfig ?
			(Array.isArray(this.formConfig) ?
				this.formConfig :
				[this.formConfig]) :
			[];

		const form = this.inheritFormConfig === false ?
			new Form(...formConfig) :
			new Form(...this.form.sourceConfig, ...formConfig);

		form.connectRows(this.formRows);
		form.setValues(data, true);
		return form;
	}

	[INJECT](data) {
		const out = [];

		if (!Array.isArray(data) || !this.formRows)
			return out;

		for (let i = 0, l = data.length; i < l; i++)
			out.push(this.getRow(data[i]));

		return out;
	}

	[EXTRACT]() {
		const value = this.value,
			out = [];

		if (!Array.isArray(value))
			return out;

		for (let i = 0, l = value.length; i < l; i++)
			out.push(value[i].extract());

		return out;
	}
}
