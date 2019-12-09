import {
	get,
	splitPath,
	hasOwn,
	equals,
	inject,
	isObject,
	resolveVal,
	splitClean,
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
import BaseInput, {
	CHECK,
	TRIGGER,
	SELF_TRIGGER,
	EXTRACT,
	SET_VALUE
} from "./inputs/base-input";
import FormRows from "./form-rows";

export default class Form extends Hookable {
	constructor(...optionsAndPresets) {
		super();

		const masterPreset = {
			hooks: {},
			options: {}
		};

		for (let i = 0, l = optionsAndPresets.length; i < l; i++) {
			const item = optionsAndPresets[i];

			if (isPreset(item)) {
				let preset = null;
	
				if (typeof hooksOrPreset == "string") {
					if (!Form.presets.hasOwnProperty(item))
						throw new Error(`Invalid preset '${item}'`);
	
					preset = Form.presets[item];
				} else
					preset = item;

				inject(masterPreset, {
					hooks: resolveVal(preset.hooks, this) || {},
					options: resolveVal(preset.options, this) || {}
				});
			} else if (isObject(item))
				inject(masterPreset.options, item, "override");
			else
				console.warn("Failed to resolve argument as it's neither a preset nor an options object:", item);
		}

		this.inputs = {};
		this.inputsStruct = {};
		this.propagateMap = {};
		this.keys = [];
		this.updateInitialized = false;

		this.valid = true;
		this.changed = false;
		// Only validate required inputs
		// Invalid non-required inputs will be marked as valid
		this.validateRequiredOnly = false;
		this.persistentInputs = false;

		this.hookAll(masterPreset.hooks);

		for (const k in masterPreset.options) {
			if (hasOwn(this, k) && hasOwn(masterPreset.options, k))
				this[k] = masterPreset.options[k];
		}
	}

	connect(name, options) {
		options = Form.normalizeOptions(options);

		if (!name || typeof name != "string")
			throw new TypeError("Cannot connect: input name must be a truthy string");

		if (!options || typeof options != "object")
			throw new TypeError("Cannot connect: input options must be an object");

		const hasField = this.inputs.hasOwnProperty(name);

		if (!hasField)
			this.keys.push(name);

		const constr = Form.getInputConstructor(options),
			inp = new constr(
				name,
				options,
				this
			);

		if (hasField) { 
			if (!Array.isArray(this.inputs[name]))
				this.inputs[name] = [this.inputs.name];

			this.inputs[name].push(inp);
		} else
			this.inputs[name] = inp;
		
		return inp;
	}

	connectRows(rows) {
		const connect = (row, depth) => {
			if (!Array.isArray(row)) {
				if (!depth && isObject(row) && typeof row.name != "string") {
					const partition = {};

					for (const k in row) {
						if (!row.hasOwnProperty(k))
							continue;

						partition[k] = connect(row[k], 0);
					}

					return partition;
				} else
					row = [row];
			}

			const out = new FormRows();

			if (depth > 1)
				throw new RangeError("Failed to process rows: row data nested past one level");

			for (let i = 0, l = row.length; i < l; i++) {
				const cell = row[i];

				if (Array.isArray(cell))
					out.push(connect(cell, depth + 1));
				else {
					let cellProcessed = null;

					if (typeof cell == "string") {
						const nameOptions = splitClean(cell, /\s*:\s*/);

						cellProcessed = {
							name: nameOptions[1] || nameOptions[0],
							opt: nameOptions[0]
						};
					} else {
						cellProcessed = Object.assign({}, cell);

						if (cellProcessed.opt)
							Form.mod({}, cellProcessed.opt, cellProcessed);
						else
							cellProcessed.opt = cellProcessed;
					}

					if (cellProcessed.classes)
						cellProcessed.class = cellProcessed.classes;
					else {
						cellProcessed.class = typeof cellProcessed.class == "string" ? {
							input: cellProcessed.class
						} : cellProcessed.class || {};
					}

					const options = cellProcessed.opt;
					delete cellProcessed.opt;
					
					cellProcessed.isInputCell = true;
					cellProcessed.input = this.connect(cellProcessed.name, options);
					out.push(depth ? cellProcessed : [cellProcessed]);
				}
			}

			return out;
		};

		this.inputsStruct = connect(rows, 0);
		return this.inputsStruct;
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

	setValues(values, noTrigger = false) {
		this.updateInitialized = true;

		this.forEach(inp => {
			if (!values.hasOwnProperty(inp.name))
				return;

			if (values[inp.name] !== null)
				inp[SET_VALUE](values[inp.name]);

			if (!noTrigger)
				inp[TRIGGER](inp.value);
		});

		this.callHooks("updated", this.inputs);
		this.updateInitialized = false;
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
			const extracted = this.extractOne(inp);

			if (extracted === undefined)
				return;

			if (typeof inp.path == "string") {
				const built = get(out, inp.path, null, "context|autoBuild");
				built.context[built.key] = extracted;
			} else
				out[name] = extracted;
		});

		return out;
	}

	extractOne(inputOrName) {
		const inp = typeof inputOrName == "string" ? this.inputs[inputOrName] : inputOrName;

		if (!(inp instanceof BaseInput))
			return;

		return inp[EXTRACT]();
	}

	clear() {
		this.updateInitialized = true;

		this.forEach(inp => {
			inp.initialized = false;
			inp.valid = true;
			inp[SET_VALUE](inp.hasOwnProperty("default") ? inp.default : "");
		});

		this.forEach(inp => inp[TRIGGER](inp.value));
		this.changed = false;

		this.callHooks("updated", this.inputs);
		this.updateInitialized = false;
	}

	trigger() {
		this.updateInitialized = true;

		this.forEach(inp => inp[TRIGGER](inp.value));

		this.callHooks("updated", this.inputs);
		this.updateInitialized = false;
	}

	val(accessor) {
		const path = splitPath(accessor),
			val = this.inputs.hasOwnProperty(path[0]) ? this.inputs[path[0]].value : null;

		return get(val, path, null, {
			pathOffset: 1
		});
	}

	static trigger(inp, ...args) {
		inp[TRIGGER](...args);
	}

	static check(inp, ...args) {
		inp[CHECK](...args);
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

	static defineDefault(name, def) {
		return this.define("default", name, def, "defaults", isObject, "supplied default is not an object");
	}

	static definePreset(name, preset) {
		return this.define("preset", name, preset, "presets", isObject, "supplied preset is not an object");
	}

	static define(type, name, data, partitionName = type, validate = null, validationMsg = null) {
		if (!type || typeof type != "string") {
			console.warn("Cannot define: type must be a truthy string");
			return this;
		}

		if (!hasOwn(this, partitionName) || !isObject(this[partitionName])) {
			console.warn(`Cannot define ${type}: invalid partition target`);
			return this;
		}

		if (!name || typeof name != "string") {
			console.warn(`Cannot define ${type}: name must be a truthy string`);
			return this;
		}

		if (hasOwn(this[partitionName], name)) {
			console.warn(`Cannot define ${type}: '${name}' is already a known preset`);
			return this;
		}

		if (typeof validate == "function") {
			const validation = validate(data);

			if (typeof validation == "string") {
				console.warn(`Cannot define ${type}: ${validation}`);
				return this;
			} else if (validation === false) {
				console.warn(`Cannot define ${type}: ${validationMsg || "validation failed"}`);
				return this;
			}
		}

		this[partitionName][name] = data;
		return this;
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

	return Boolean(candidate) && (hasOwn(candidate, "hooks") || hasOwn(candidate, "options"));
}
