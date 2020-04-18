import Input, {
	INJECT,
	EXTRACT,
	SELF_VALIDATE,
	DISPATCH_VALUE,
	DISPATCH_CHANGE,
	DISPATCH_CHANGED,
	DISPATCH_CHANGESTATECHANGE
} from "./input";
import Form from "../form";

export default class List extends Input {
	constructor(name, options, form) {
		super(name, options, form, {
			formRows: "Array|Object",
			formConfig: "string|Object|Array",
			inheritFormConfig: "boolean",
			rearrangeable: "boolean",
			beforeadd: "function",
			beforemove: "function",
			beforeremove: "function"
		});
		this.changeMap = null;
		this.finishInit();
	}

	finishInit() {
		super.finishInit();
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

		form.connectRows(this.formRows, data);
		form.changed = false;
		form.hook("validstatechange", _ => this[SELF_VALIDATE]());
		form.hook("changestatechange", _ => this[DISPATCH_VALUE](this.value, this.value));
		form.hook("change", _ => this[DISPATCH_CHANGE](this.value, this.value));
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

	[DISPATCH_CHANGED](changed) {
		if (!changed) {
			const changeMap = [],
				value = this.value;

			for (let i = 0, l = value.length; i < l; i++) {
				value[i].changed = false;
				changeMap.push({
					form: value[i],
					changed: false
				});
			}

			this.changeMap = changeMap;
			this.changeData.value = changeMap;
		}
	}

	[DISPATCH_VALUE](value, oldValue) {
		this.dynamicValue.value = value;

		const changeMap = [],
			oldChangeMap = this.changeMap;

		for (let i = 0, l = value.length; i < l; i++) {
			changeMap.push({
				form: value[i],
				changed: value[i].changed
			});
		}

		if (this.changeData.value === null)
			this.changeData.value = changeMap;
		this.changeMap = changeMap;

		const changed = (map, map2) => {
			if (!map && !map2)
				return false;

			if (!map ^ !map2 || map.length != map2.length)
				return true;

			for (let i = 0, l = map.length; i < l; i++) {
				const m = map[i],
					m2 = map2[i];

				if (m.form != m2.form || m.changed != m2.changed)
					return true;
			}

			return false;
		};

		if (this.instantiated && changed(oldChangeMap, changeMap)) {
			const chng = changed(this.changeData.value, changeMap);
			this[DISPATCH_CHANGE](value, oldValue);
			this[DISPATCH_CHANGESTATECHANGE](chng, value, oldValue);
			this.modified = true;
		}

		this[SELF_VALIDATE]();
	}
}
