import {
	equals,
	resolveVal,
	isObject,
	splitPath,
	get,
	composeOptionsTemplates,
	createOptionsObject
} from "@qtxr/utils";
import { Hookable } from "@qtxr/bc";

import defaults from "./form-defaults";

// Inputs
import {
	inputTypes,
	inputConstructors
} from "./inputs";
import {
	CHECK,
	TRIGGER,
	SELF_TRIGGER
} from "./inputs/base-input";

export default class Form extends Hookable {
	constructor(hooksOrPreset = {}, options = {}) {
		super();
		
		let hooks = hooksOrPreset,
			preset = null;

		if (isPreset(hooksOrPreset)) {
			if (typeof hooksOrPreset == "string") {
				if (!Form.presets.hasOwnProperty(hooksOrPreset))
					throw new Error(`Invalid preset '${hooksOrPreset}'`);

				preset = Form.presets[hooksOrPreset];
			} else
				preset = hooksOrPreset;

			hooks = resolveVal(preset.hooks, this) || {};
			options = Object.assign({}, resolveVal(preset.options, this), options);
		}

		this.inputs = {};
		this.propagateMap = {};
		this.keys = [];

		this.valid = true;
		this.changed = false;
		// Only validate required inputs
		// Invalid non-required inputs will be marked as valid
		this.validateRequiredOnly = false;

		this.hookAll(hooks);

		for (const k in options) {
			if (this.hasOwnProperty(k) && options.hasOwnProperty(k))
				this[k] = options[k];
		}
	}

	connect(name, options) {
		options = Form.normalizeOptions(options);

		if (!name || typeof name != "string") {
			console.error("Invalid input name");
			return this;
		}

		if (!options || typeof options != "object") {
			console.error("Invalid input options");
			return this;
		}

		const constr = Form.getInputConstructor(options),
			input = new constr(
				name,
				options,
				this
			);

		if (!this.inputs.hasOwnProperty(name))
			this.keys.push(name);
		
		this.inputs[name] = input;
		return this;
	}

	// TODO: make polymorphic
	connectAll(inputs) {
		for (const k in inputs) {
			if (!inputs.hasOwnProperty(k))
				continue;

			this.connect(k, inputs[k]);
		}

		return this;
	}

	disconnect(name) {
		if (this.inputs.hasOwnProperty(name)) {
			delete this.inputs[name];
			this.keys.splice(this.keys.indexOf(name));
		}
	}

	propagate(targets) {
		const send = name => {
			if (this.inputs.hasOwnProperty(name) && !this.propagateMap.hasOwnProperty(name)) {
				this.propagateMap[name] = true;
				this.inputs[name][SELF_TRIGGER](null);
			}
		};

		if (Array.isArray(targets))
			targets.forEach(send);
		else if (targets && typeof targets == "object") {
			for (const k in targets)
				send(k);
		} else if (typeof targets == "string")
			send(targets);
	}

	setValues(values) {
		this.forEach(inp => {
			if (values.hasOwnProperty(inp.name)) {
				inp.value = values[inp.name];
				inp[TRIGGER](inp.value);
			}
		});
	}

	setInputs(data) {
		this.forEach(inp => {
			if (data.hasOwnProperty(inp.name) && isObject(data[inp.name]))
				Object.assign(inp, data[inp.name]);
		});
	}

	forEach(callback) {
		if (typeof callback != "function")
			return;

		const keys = this.keys;

		for (let i = 0, l = this.keys.length; i < l; i++)
			callback(this.inputs[keys[i]], keys[i], this.inputs);
	}

	extract() {
		const out = {};

		this.forEach((inp, name) => {
			if (typeof inp.extract == "function") {
				const extracted = inp.extract(inp.value, inp, out, this.inputs);

				if (extracted !== undefined)
					out[name] = extracted;
			} else
				out[name] = inp.value;
		});

		return out;
	}

	clear() {
		this.forEach(inp => {
			inp.initialized = false;
			inp.valid = true;
			inp.value = inp.hasOwnProperty("default") ? inp.default : "";
		});

		this.forEach(inp => inp[TRIGGER](inp.value));
		this.changed = false;
	}

	trigger() {
		this.forEach(inp => inp[TRIGGER](inp.value));
	}

	val(accessor) {
		const path = splitPath(accessor),
			val = this.inputs.hasOwnProperty(path[0]) ? this.inputs[path[0]].value : null;

		return get(val, path, null, {
			pathOffset: 1
		});
	}

	static trigger(input, ...args) {
		input[TRIGGER](...args);
	}

	static check(input, ...args) {
		input[CHECK](...args);
	}

	static normalizeOptions(options) {
		if (typeof options == "function") {
			return {
				validate: options
			};
		}

		return Object.assign({}, createOptionsObject(
			options,
			Form.defaults,
			`Form has no default input '${options}'`
		));
	}

	// Standard function to modify input options
	static mod(options, ...mods) {
		options = Form.normalizeOptions(options);

		for (let i = 0, l = mods.length; i < l; i++) {
			const m = mods[i];

			switch (typeof m) {
				case "boolean":
					options.required = m;
					break;
				case "function":
					options.validate = m;
					break;
				case "object":
					Object.assign(options, m);
					break;
				case "string":
					Object.assign(options, Form.normalizeOptions(m));
					break;
			}
		}

		return options;
	}

	static getInputType(optionsOrInput) {
		if (!optionsOrInput)
			return inputTypes.default;

		return inputTypes.hasOwnProperty(optionsOrInput.type) ?
			inputTypes[optionsOrInput.type] :
			inputTypes.default;
	}

	static getInputConstructor(optionsOrInput) {
		const type = this.getInputType(optionsOrInput);

		return inputConstructors.hasOwnProperty(type) ?
			inputConstructors[type] :
			inputConstructors.default;
	}
}

Form.defaults = composeOptionsTemplates(defaults);

Form.presets = {
	std: {
		hooks: {
			trigger(form) {
				let valid = true;
				form.forEach(inp => {
					valid &= (inp.required === false || (inp.initialized && inp.valid));
				});
				form.valid = !!valid;
			}
		},
		options: {
			valid: false,
			validateRequiredOnly: true
		}
	}
};

// value, input, inputs
Form.validators = {
	notNull: val => val === null ? "Please select a value" : null
};

// value, input, inputs
Form.processors = {

};

// value, input, inputs
Form.triggers = {

};

// input, inputs
Form.updaters = {

};

// value, input, output, inputs
Form.extractors = {

};

// value, reference value
Form.comparators = {
	deep: equals
};

function isPreset(candidate) {
	if (typeof candidate == "string")
		return true;

	return Boolean(candidate) && candidate.hasOwnProperty("hooks") && candidate.hasOwnProperty("options");
}
