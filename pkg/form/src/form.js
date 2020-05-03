import {
	get,
	set,
	splitPath,
	isObj,
	hasOwn,
	alias,
	equals,
	inject,
	forEach,
	isObject,
	partition,
	resolveVal,
	resolveArgs,
	splitClean,
	requestFrame,
	composePresets,
	addPreset,
	mergePresets,
	createOptionsObject
} from "@qtxr/utils";
import { Hookable } from "@qtxr/bc";
import { KeyedLinkedList } from "@qtxr/ds"; 

import templates from "./templates";

// Inputs
import {
	inputTypes,
	inputConstructors
} from "./inputs";
import Input, {
	CHECK,
	TRIGGER,
	SELF_TRIGGER,
	EXTRACT
} from "./inputs/input";
import FormRows from "./form-rows";

let id = 0;

const partitionClassifier = {
	validateRequiredOnly: "options",
	noDuplicateNames: "options",
	bareInputs: "options"
};

const LINK_PARAMS = [
	{ name: "source", type: "object|function", default: null },
	{ name: "target", type: "object|function", default: null },
	{ name: "async", type: "boolean", default: false }
];

const LINK_ROWS_PARAMS = [
	{ name: "rows", type: "Object|Array", required: true },
	{ name: "source", type: "object|function", default: null },
	{ name: "target", type: "object|function", default: null },
	{ name: "async", type: "boolean", default: false }
];

export default class Form extends Hookable {
	constructor(...optionsAndPresets) {
		super({
			hookable: {
				noOwnerArg: true
			}
		});

		const masterPreset = {
			hooks: {},
			options: {},
			meta: {}
		};

		for (let i = 0, l = optionsAndPresets.length; i < l; i++) {
			const item = optionsAndPresets[i];

			// A preset is identified as an object containing at least
			// a hooks, options, or meta property, or a string representing
			// a predefined preset
			if (isPreset(item)) {
				let preset = null;
	
				if (typeof item == "string") {
					if (!hasOwn(Form.presets, item))
						throw new Error(`Invalid preset '${item}'`);
	
					preset = Form.presets[item];
				} else
					preset = item;

				inject(masterPreset, {
					hooks: resolveVal(preset.hooks, this.mkRuntime()) || {},
					options: resolveVal(preset.options, this.mkRuntime()) || {},
					meta: resolveVal(preset.meta, this.mkRuntime()) || {}
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
		this.invalidInputs = new KeyedLinkedList();
		this.changes = new KeyedLinkedList();
		this.meta = masterPreset.meta;

		this.options = {
			// Only validate required inputs
			// Invalid non-required inputs will be marked as valid
			validateRequiredOnly: false,
			// Don't allow inputs with duplicate names. If false,
			// extracted inputs with the same name will be returned
			// in an array, ergo with a minimum length of 2 
			noDuplicateNames: true,
			// Master switch for bare inputs. A bare input is an
			// input with minimal vendor graphics (autocomplete
			// dropdowns, etc)
			bareInputs: false
		};

		this.hookAll(masterPreset.hooks);

		partition(masterPreset.options, {
			options: this.options
		}, partitionClassifier, "options");
	}

	connect(name, options) {
		name = Form.resolveInputName(name) || Form.resolveInputName(options);
		options = Form.normalizeOptions(options);

		if (!name || typeof name != "string")
			throw new TypeError("Cannot connect: input name must be a truthy string");

		if (!options || typeof options != "object")
			throw new TypeError("Cannot connect: input options must be an object");

		const hasField = hasOwn(this.inputs, name);

		if (!hasField)
			this.keys.push(name);
		else if (this.options.noDuplicateNames)
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

	connectRows(rows, values = {}) {
		const foundNames = {};
		
		const connect = (row, depth) => {
			if (!Array.isArray(row)) {
				if (!depth && isObject(row) && Form.resolveInputName(row) == null) {
					const partition = {};

					for (const k in row) {
						if (!hasOwn(row, k))
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

				if (Array.isArray(cell)) {
					out.push(connect(cell, depth + 1));
					continue;
				}

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
					cellProcessed.class = typeof cellProcessed.class == "string" ?
						{ input: cellProcessed.class } :
						cellProcessed.class || {};
				}

				const options = cellProcessed.opt,
					name = Form.resolveInputName(cellProcessed.name) || Form.resolveInputName(options);
				delete cellProcessed.opt;
				
				// Clear old inputs when necessary
				if (!hasOwn(foundNames, name)) {
					if (!this.options.noDuplicateNames)
						delete this.inputs[name];

					foundNames[name] = true;
				} else if (this.options.noDuplicateNames)
					throw new Error(`Cannot connect: duplicate inputs by name "${name}". To support multiple inputs with the same name, use the 'noDuplicateNames' option`);

				if (values && hasOwn(values, name))
					options.value = values[name];

				cellProcessed.input = this.connect(name, options);
				cellProcessed.isInputCell = true;
				out.push(depth ? cellProcessed : [cellProcessed]);
			}

			return out;
		};

		this.inputsStruct = connect(rows, 0);
		this.callHooks("connected", this.inputsStruct);
		return this.inputsStruct;
	}

	// Combines connectRows and link,
	// with support for async connection
	linkRows(...args) {
		const {
			rows,
			source,
			target,
			async
		} = resolveArgs(args, LINK_ROWS_PARAMS);

		const dispatch = _ => {
			const struct = this.connectRows(rows);
			this.link(source, target);
			return struct;
		};

		if (async) {
			return new Promise(res => {
				requestFrame(_ => res(dispatch()));
			});
		}

		return dispatch();
	}

	link(...args) {
		let {
			source,
			target,
			async
		} = resolveArgs(args, LINK_PARAMS);

		if (!target)
			target = source;

		const dispatch = _ => {
			const src = resolveVal(source, this.mkRuntime());

			if (!isObj(src))
				throw new Error("Cannot link: link source must be an object");

			this.hook("change", runtime => {
				const targ = resolveVal(target, runtime);
				this.extractOne(runtime.input, targ, true);
			});

			this.setValues(src, true);
		};

		if (async)
			requestFrame(dispatch);
		else
			dispatch();
		
		return this;
	}

	disconnect(name) {
		if (hasOwn(this.inputs, name)) {
			delete this.inputs[name];
			this.keys.splice(this.keys.indexOf(name));
		}
	}

	propagate(targets) {
		const send = name => {
			if (hasOwn(this.inputs, name) && !hasOwn(this.propagateMap, name)) {
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

			if (!matched && !hasOwn(values, inp.name))
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
			if (hasOwn(data, inp.name) && isObject(data[inp.name]))
				Object.assign(inp, data[inp.name]);
		});
	}

	extract(inputOrName = null, target = null) {
		if (typeof inputOrName == "string" || inputOrName instanceof Input)
			return this.extractOne(inputOrName);

		target = target || {};
		this.forEach(inp => this.extractOne(inp, target, false, true));
		return target;
	}

	extractOne(inputOrName, target = null, replace = false, demux = false) {
		const inp = typeof inputOrName == "string" ?
			this.inputs[inputOrName] :
			inputOrName;

		if (!(inp instanceof Input))
			return;

		const extracted = inp[EXTRACT](null, demux);
		let val = demux ? extracted.value : extracted,
			source = demux ? extracted.source : "native";

		if (inp.nullable && val == null)
			val = null;

		if (target && val !== undefined) {
			if (source == "demux") {
				for (const k in val) {
					if (hasOwn(val, k))
						set(target, k, val[k]);
				}
			} else if (typeof inp.path == "string")
				set(target, inp.path, val);
			else {
				const name = inp.name;

				if (!replace && hasOwn(target, name)) {
					if (!Array.isArray(target[name]))
						target[name] = [target[name]];

					target[name].push(val);
				} else
					target[name] = val;
			}
		}

		return extracted;
	}

	forEach(callback, forAll = false) {
		if (typeof callback != "function")
			return;

		const dispatch = (inp, key) => {
			if (!forAll && !inp.exists)
				return true;

			return callback(inp, key, this.inputs);
		};

		const keys = this.keys;

		for (let i = 0, l = this.keys.length; i < l; i++) {
			const key = keys[i],
				item = this.inputs[key];

			if (Array.isArray(item)) {
				for (let j = 0, l2 = item.length; j < l2; j++) {
					if (dispatch(item[j], key) === false)
						return false;
				}
			} else if (dispatch(item, key) === false)
				return false;
		}

		return true;
	}

	clear() {
		this.updateInitialized = true;
		this.forEach(inp => {
			inp.clear();
		});
		this.callHooks("updated", this.inputs);
		this.updateInitialized = false;
	}

	trigger() {
		this.updateInitialized = true;
		this.forEach(inp => {
			inp[TRIGGER](inp.value);
		});
		this.callHooks("updated", this.inputs);
		this.updateInitialized = false;
	}

	val(accessor, format = null) {
		const path = splitPath(accessor),
			val = hasOwn(this.inputs, path[0]) ?
				this.inputs[path[0]].val(format) :
				null;

		return get(val, path, null, {
			pathOffset: 1
		});
	}

	validate() {
		return this.forEach(inp => inp.validate().valid);
	}

	// Semi-private methods
	updateValid(inputOrName, valid = null) {
		const inp = typeof inputOrName == "string" ?
			this.inputs[inputOrName] :
			inputOrName;

		if (!inp)
			return;
		
		valid = typeof valid == "boolean" ?
			valid :
			inp.valid;

		const size = this.invalidInputs.size;

		if (valid)
			this.invalidInputs.delete(inp.name);
		else
			this.invalidInputs.push(inp.name, inp);

		if (!size ^ !this.invalidInputs.size)
			this.callHooks("validstatechange", !this.invalidInputs.size, this.invalidInputs);
	}

	updateChanged(inputOrName, changed = null) {
		const inp = typeof inputOrName == "string" ?
			this.inputs[inputOrName] :
			inputOrName;

		if (!inp)
			return;
		
		changed = typeof changed == "boolean" ?
			changed :
			inp.changed;

		const size = this.changes.size;

		if (changed)
			this.changes.push(inp.name, inp);
		else
			this.changes.delete(inp.name);
		
		if (!size ^ !this.changes.size)
			this.callHooks("changestatechange", Boolean(this.changes.size), this.changes);
	}

	mkRuntime(...sources) {
		const runtime = {
			form: this,
			inputs: this.inputs,
			inputsStruct: this.inputsStruct
		};

		for (let i = 0, l = sources.length; i < l; i++) {
			const src = sources[i];

			// This feature is primarily supported to unify the APIs
			// of Form and view layer implementations like @qtxr/vue-form
			if (typeof src == "string") {
				const [
					key,
					path
				] = src.split(":");

				runtime[key] = get(runtime, path);
			} else if (isObject(src))
				inject(runtime, src, "override");
		}

		return runtime;
	}

	callHooks(partitionName, ...args) {
		super.callHooks(
			partitionName,
			this.mkRuntime({
				partitionName
			}),
			...args
		);
	}

	callHooksWithCustomRuntime(partitionName, runtime) {
		return (...args) => {
			super.callHooks(
				partitionName,
				runtime,
				...args
			);
		};
	}

	get changed() {
		return Boolean(this.changes.size);
	}

	set changed(changed) {
		this.forEach(inp => {
			inp.changed = changed;
		});
	}

	get valid() {
		return !this.invalidInputs.size;
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

		options = createOptionsObject(
			options,
			Form.templates,
			`Form has no default input '${options}'`
		);

		return mergePresets(options, Form.templates, {
			defaultKey: "default",
			keys: ["template", "templates", "default", "defaults"]
		});
	}

	static resolveInputName(nameOrConfig) {
		if (isObject(nameOrConfig)) {
			if (typeof nameOrConfig.name == "string")
				return nameOrConfig.name ? nameOrConfig.name : null;
			
			if (!hasOwn(nameOrConfig, "name") && typeof nameOrConfig.path == "string")
				return "@path@:" + nameOrConfig.path;

			return null;
		}
		
		return (nameOrConfig && typeof nameOrConfig == "string") ?
			nameOrConfig :
			null;
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

		return hasOwn(inputTypes, optionsOrInput.type) ?
			inputTypes[optionsOrInput.type] :
			inputTypes.default;
	}

	static getInputConstructor(optionsOrInput) {
		const type = this.getInputType(optionsOrInput);

		return hasOwn(inputConstructors, type) ?
			inputConstructors[type] :
			inputConstructors.default;
	}

	static defineTemplate(name, template) {
		return this.define({
			type: "template",
			target: Form.templates,
			name,
			data: template,
			validate: isObject,
			validationMsg: "supplied default is not an object",
			apply: _ => addPreset(Form.templates, name, template)
		});
	}

	static definePreset(name, preset) {
		return this.define({
			type: "preset",
			target: Form.presets,
			name,
			data: preset,
			validate: isObject,
			validationMsg: "supplied preset is not an object",
			apply: _ => addPreset(Form.templates, name, preset)
		});
	}

	static define(options) {
		const {
			type,
			target,
			name,
			data,
			validate = null,
			validationMsg = null,
			apply = null
		} = options;

		const warn = msg => {
			console.warn(msg);
			return this;
		};

		if (!type || typeof type != "string")
			return warn("Cannot define: type must be a truthy string");

		if (!isObject(target))
			return warn(`Cannot define ${type}: invalid partition target`);

		if (!name || typeof name != "string")
			return warn(`Cannot define ${type}: name must be a truthy string`);

		if (hasOwn(target, name))
			return warn(`Cannot define ${type}: '${name}' is already a known ${type}`);

		if (typeof validate == "function") {
			const validation = validate(data);

			if (typeof validation == "string")
				return warn(`Cannot define ${type}: ${validation}`);
			else if (validation === false)
				return warn(`Cannot define ${type}: ${validationMsg || "validation failed"}`);
		}

		if (typeof apply == "function")
			apply(target, name, data);
		else
			target[name] = data;

		return this;
	}

	// DEPRECATED: use connectRows instead
	connectAll(inputs) {
		for (const k in inputs) {
			if (!hasOwn(inputs, k))
				continue;

			this.connect(k, inputs[k]);
		}

		return this;
	}
}

alias(Form.prototype, {
	extractOne: "pluck",
	hook: "on",
	unhook: "off"
});

Form.templates = composePresets(templates);
Form.presets = composePresets({
	std: {
		options: {
			validateRequiredOnly: true
		}
	},
	bare: {
		options: {
			bareInputs: true
		}
	}
});

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

	return isObject(candidate) && (hasOwn(candidate, "hooks") || hasOwn(candidate, "options") || hasOwn(candidate, "meta"));
}
