import {
	get,
	splitPath,
	isObj,
	hasOwn,
	equals,
	inject,
	forEach,
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
	EXTRACT
} from "./inputs/base-input";
import FormRows from "./form-rows";

let id = 0;

export default class Form extends Hookable {
	constructor(...optionsAndPresets) {
		super();

		const masterPreset = {
			hooks: {},
			options: {},
			meta: {}
		};

		for (let i = 0, l = optionsAndPresets.length; i < l; i++) {
			const item = optionsAndPresets[i];

			if (isPreset(item)) {
				let preset = null;
	
				if (typeof item == "string") {
					if (!Form.presets.hasOwnProperty(item))
						throw new Error(`Invalid preset '${item}'`);
	
					preset = Form.presets[item];
				} else
					preset = item;

				inject(masterPreset, {
					hooks: resolveVal(preset.hooks, this) || {},
					options: resolveVal(preset.options, this) || {},
					meta: resolveVal(preset.meta, this) || {}
				}, "override");
			} else if (isObject(item))
				inject(masterPreset.options, item, "override");
			else if (item != null)
				console.warn("Failed to resolve argument as it's neither a preset nor an options object:", item);
		}

		// Constants
		this.sourceConfig = optionsAndPresets;
		this.id = id++;

		// Input tracking
		this.keys = [];
		this.inputId = 0;
		this.inputs = {};
		this.inputsStruct = {};
		this.propagateMap = {};
		this.updateInitialized = false;

		// State
		this.valid = true;
		this.changed = false;
		this.meta = masterPreset.meta;

		// Flags / general config
		// Only validate required inputs
		// Invalid non-required inputs will be marked as valid
		this.validateRequiredOnly = false;
		// Don't allow inputs with duplicate names. If false,
		// extracted inputs with the same name will be returned
		// in an array, ergo with a minimum length of 2 
		this.noDuplicateNames = true;
		// Master switch for bare inputs. A bare input is an
		// input with minimal vendor graphics (autocomplete
		// dropdowns, etc)
		this.bareInputs = false;

		this.hookAll(masterPreset.hooks);

		for (const k in masterPreset.options) {
			if (hasOwn(this, k) && hasOwn(masterPreset.options, k))
				this[k] = masterPreset.options[k];
		}
	}

	connect(name, options) {
		name = Form.resolveInputName(name) || Form.resolveInputName(options);
		options = Form.normalizeOptions(options);

		if (!name || typeof name != "string")
			throw new TypeError("Cannot connect: input name must be a truthy string");

		if (!options || typeof options != "object")
			throw new TypeError("Cannot connect: input options must be an object");

		const hasField = this.inputs.hasOwnProperty(name);

		if (!hasField)
			this.keys.push(name);
		else if (this.noDuplicateNames)
			return this.inputs[name];

		const constr = Form.getInputConstructor(options),
			inp = new constr(
				name,
				options,
				this
			);

		inp.id = this.inputId++;

		if (hasField) { 
			if (!Array.isArray(this.inputs[name]))
				this.inputs[name] = [this.inputs[name]];

			this.inputs[name].push(inp);
		} else
			this.inputs[name] = inp;
		
		return inp;
	}

	connectRows(rows) {
		const foundNames = {};
		
		const connect = (row, depth) => {
			if (!Array.isArray(row)) {
				if (!depth && isObject(row) && Form.resolveInputName(row) == null) {
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
				throw new RangeError("Cannot connect: row data nested past one level");

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

					const options = cellProcessed.opt,
						name = Form.resolveInputName(cellProcessed.name) || Form.resolveInputName(options);
					delete cellProcessed.opt;
					
					// Clear old inputs when necessary
					if (!foundNames.hasOwnProperty(name)) {
						if (!this.noDuplicateNames)
							delete this.inputs[name];

						foundNames[name] = true;
					} else if (this.noDuplicateNames)
						throw new Error(`Cannot connect: duplicate inputs by name "${name}"`);

					cellProcessed.input = this.connect(name, options);
					cellProcessed.isInputCell = true;
					out.push(depth ? cellProcessed : [cellProcessed]);
				}
			}

			return out;
		};

		this.inputsStruct = connect(rows, 0);
		return this.inputsStruct;
	}

	// DEPRECATED: use connectRows instead
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

	link(target) {
		if (!isObj(target))
			throw new Error("Cannot link: link target must be an object");

		this.setValues(target, true);
		this.hook("update", (f, inp) => this.extractOne(inp, target, true));
		return this;
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
			let value = values[inp.name],
				matched = false;

			if (inp.path == "" || inp.path) {
				const gotten = get(values, inp.path, null, "context");
				if (gotten.match) {
					matched = true;
					value = gotten.data;
				}
			}

			if (!matched && !values.hasOwnProperty(inp.name))
				return;

			if (value !== null)
				inp.setValue(value);

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

	extract(inputOrName = null) {
		if (typeof inputOrName == "string" || inputOrName instanceof BaseInput)
			return this.extractOne(inputOrName);

		const out = {};
		this.forEach(inp => this.extractOne(inp, out));
		return out;
	}

	extractOne(inputOrName, target = null, replace = false) {
		const inp = typeof inputOrName == "string" ?
			this.inputs[inputOrName] :
			inputOrName;

		if (!(inp instanceof BaseInput))
			return;

		let val = inp[EXTRACT]();

		if (inp.nullable && val == null)
			val = null;

		if (target && val !== undefined) {
			if (typeof inp.path == "string") {
				const built = get(target, inp.path, null, "context|autoBuild");
				built.context[built.key] = val;
			} else {
				const name = inp.name;

				if (!replace && target.hasOwnProperty(name)) {
					if (!Array.isArray(target[name]))
						target[name] = [target[name]];

					target[name].push(val);
				} else
					target[name] = val;
			}
		}

		return val;
	}

	clear() {
		this.updateInitialized = true;

		this.forEach(inp => {
			inp.initialized = false;
			inp.valid = true;
			inp.updateValue(inp.hasOwnProperty("default") ? inp.default : "");
		});

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

	forEach(callback) {
		if (typeof callback != "function")
			return;

		const dispatch = (inp, key) => {
			if (!inp.exists)
				return;

			callback(inp, key, this.inputs);
		};

		const keys = this.keys;

		for (let i = 0, l = this.keys.length; i < l; i++) {
			const key = keys[i],
				item = this.inputs[key];

			if (Array.isArray(item)) {
				for (let j = 0, l2 = item.length; j < l2; j++)
					dispatch(item[j], key);
			} else
				dispatch(item, key);
		}
	}

	validate() {
		let valid = true;
	
		this.forEach(inp => {
			valid = valid && inp.validate().valid;
		});
	
		return valid;
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

	static resolveInputName(nameOrConfig) {
		if (isObject(nameOrConfig)) {
			if (typeof nameOrConfig.name == "string")
				return nameOrConfig.name ? nameOrConfig.name : null;
			
			if (!nameOrConfig.hasOwnProperty("name") && typeof nameOrConfig.path == "string")
				return "@@name-from-path@@:" + nameOrConfig.path;

			return null;
		}
		
		return (nameOrConfig && typeof nameOrConfig == "string") ? nameOrConfig : null;
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

	static gen(dataOrLength, callback) {
		const out = [];

		if (typeof dataOrLength == "number") {
			for (let i = 0; i < dataOrLength; i++) {
				const val = callback(i, i, dataOrLength);
				if (val)
					out.push(val);
			}
		} else {
			forEach(dataOrLength, (v, k, o) => {
				const val = callback(v, k, o);
				if (val)
					out.push(val);
			});
		}

		return out;
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
			trigger: form => form.valid = form.validate()
		},
		options: {
			valid: false,
			validateRequiredOnly: true
		}
	},
	bare: {
		options: {
			bareInputs: true
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
