import {
	resolveVal,
	isObject,
	composeOptionsTemplates,
	createOptionsObject
} from "@qtxr/utils";
import { Hookable } from "@qtxr/bc";
import Input, {
	CHECK,
	TRIGGER,
	SELF_TRIGGER
} from "./input";
import defaults from "./form-defaults";

export default class Form extends Hookable {
	constructor(hooksOrPreset = {}, options = {}) {
		super();
		
		let hooks = hooksOrPreset,
			preset = null;

		if (typeof hooksOrPreset == "string") {
			if (!Form.presets.hasOwnProperty(hooksOrPreset))
				throw new Error(`Invalid preset '${hooksOrPreset}'`);

			preset = Form.presets[hooksOrPreset];
			hooks = resolveVal(preset.hooks, this) || {};
			options = resolveVal(preset.options, this) || {};
		}

		this.inputs = {};
		this.propagateMap = {};
		this.keys = [];

		this.valid = true;
		this.changed = false;
		// Only validate required inputs
		// Invalid non-required inputs will be marked as
		// valid
		this.validateRequiredOnly = false;

		if (hooks) {
			for (const k in hooks) {
				if (hooks.hasOwnProperty(k))
					this.hook(k, hooks[k]);
			}
		}

		for (const k in options) {
			if (this.hasOwnProperty(k) && options.hasOwnProperty(k))
				this[k] = options[k];
		}
	}

	connect(name, options) {
		options = Form.normalizeOptions(options);

		if (!options) {
			console.error("Invalid input options");
			return this;
		}

		if (this.inputs.hasOwnProperty(name)) {
			console.error(`Input by name '${name}' is already specified`);
			return this;
		}
		
		const input = new Input(
			name,
			options,
			this
		);

		this.inputs[name] = input;
		this.keys.push(name);
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
			targets.forforEach(send);
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
				const extracted = inp.extract(inp.value, inp, out);

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

		this.forEach(inp => inp[TRIGGER](inp.value, true));
		this.changed = false;
	}

	trigger() {
		this.forEach(inp => inp[TRIGGER](inp.value, true));
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

		return createOptionsObject(
			options,
			Form.defaults,
			`Form has no default input '${options}'`
		);
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
}

Form.defaults = composeOptionsTemplates(defaults);

Form.presets = {
	std: {
		hooks: {
			trigger(f) {
				let valid = true;
				f.forEach(inp => valid &= (inp.required === false || (inp.initialized && inp.valid)));
				f.valid = !!valid;
			}
		},
		options: {
			valid: false,
			validateRequiredOnly: true
		}
	}
};

Form.validators = {
	notNull: (val, inp, inps) => val === null ? "Please select a value" : null
};
