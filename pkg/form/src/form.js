import {
	get,
	set,
	map,
	splitPath,
	isObj,
	hasOwn,
	keys,
	alias,
	equals,
	inject,
	mkPath,
	forEach,
	mkClass,
	isObject,
	joinClass,
	partition,
	resolveVal,
	resolveArgs,
	requestFrame,
	composePresets,
	addPreset,
	mergePresets,
	createOptionsObject
} from "@qtxr/utils";
import { Hookable } from "@qtxr/bc";
import {
	Trie,
	KeyedLinkedList
} from "@qtxr/ds";

import templates from "./assets/templates";
import InputGroupProxy from "./core/input-group-proxy";
import InputBlock from "./core/input-block";

// Inputs
import {
	inputTypes,
	inputConstructors
} from "./inputs";
import Input, {
	CHECK,
	UPDATE,
	TRIGGER,
	SELF_TRIGGER,
	TRIGGER_VALIDATE,
	EXTRACT, SYMBOLS
} from "./inputs/input";
import AbstractInput from "./inputs/abstract-input";

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
			meta: {},
			dictionary: {}
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
					meta: resolveVal(preset.meta, this.mkRuntime()) || {},
					dictionary: resolveVal(preset.dictionary, this.mkRuntime()) || {}
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
		this.inputsFromPaths = {};
		this.inputNames = new Trie();
		this.inputPaths = new Trie();
		this.propagateMap = {};
		this.updateInitialized = false;

		// State
		this.invalidInputs = new KeyedLinkedList();
		this.invalidNonRequiredInputs = new KeyedLinkedList();
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
		if (isObject(name) && !name.isResolvedInputName) {
			options = name;
			name = null;
		}

		const nData = Form.resolveInputName(name) || Form.resolveInputName(options);
		name = nData && nData.name;
		options = Form.resolveOptions(options);

		if (!name)
			throw new TypeError("Cannot connect: input name/config doesn't resolve a valid string name");

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
				this.inputs[name] = new InputGroupProxy(this.inputs[name]);

			this.inputs[name].push(inp);
		} else
			this.inputs[name] = inp;

		if (nData.fromPath) {
			this.inputsFromPaths[name] = this.inputs[name];
			this.inputPaths.set(splitPath(nData.raw), this.inputs[name]);
		} else
			this.inputNames.set(splitPath(name), this.inputs[name]);

		return inp;
	}

	connectRows(rows, sourceValues = {}) {
		const foundNames = {};

		const hasBlocks = cells => {
			for (let i = 0, l = cells.length; i < l; i++) {
				if (Array.isArray(cells[i]))
					return true;
			}

			return false;
		};

		const getBlockType = (struct, parentStruct, depth = 0) => {
			if (!depth || (depth == 1 && hasBlocks(struct)))
				return "column";

			if (depth > 1) {
				if (parentStruct)
					return parentStruct.type == "row" ? "column" : "row";

				return depth % 2 == 0 ? "column" : "row";
			}

			return "row";
		};

		const resolveBlockLayout = (struct, parentStruct, depth = 0) => {
			if (!Array.isArray(struct))
				return;

			// Resolve inline cells
			for (let i = 0; i < struct.length; i++) {
				const block = struct[i],
					blockIdx = i;

				if (!depth || !block.isInputBlock)
					continue;

				let buffer = [],
					offset = 0,
					buffering = false;

				for (let j = 0, l = block.length; j < l; j++) {
					const cell = block[j];
					if (isObject(cell) && cell.inline) {
						buffering = true;

						if (buffer.length) {
							i++;
							struct.splice(i, 0, new InputBlock(...buffer));
							buffer = [];
						}

						i++;
						offset++;
						struct.splice(i, 0, cell);
					} else if (buffering) {
						buffer.push(cell);
						offset++;
					}

					block[j] = block[j + offset];
				}

				if (buffer.length) {
					i++;
					struct.splice(i, 0, new InputBlock(...buffer));
				}

				block.length -= offset;
				if (!block.length)
					struct.splice(blockIdx, 1);
			}

			struct.type = getBlockType(struct, parentStruct, depth);

			for (let i = 0, l = struct.length; i < l; i++) {
				if (struct[i].isInputBlock) {
					resolveBlockLayout(struct[i], struct, depth + 1);
					if (!struct[i].length) {
						struct.splice(i, 1);
						i++;
					}
				} else if (!depth)
					struct[i] = new InputBlock(struct[i]);
			}
		};

		const connect = (row, struct = null, depth = 0) => {
			if (isObject(row) && hasOwn(row, "group"))
				row = Form.resolveGroup(row);
			if (!depth && isResolvableInput(row))
				row = [row];

			// If no name can be inferred from an object,
			// treat it as an object containing inputs
			if (!depth && isObject(row) && Form.resolveInputName(row) == null) {
				return map(row, c => {
					const block = connect(c, new InputBlock(), depth);
					resolveBlockLayout(block);
					return block;
				});
			}

			// Rows
			if (Array.isArray(row)) {
				const block = new InputBlock();

				if (!struct)
					struct = block;
				else
					struct.push(block);

				for (let i = 0, l = row.length; i < l; i++)
					connect(row[i], block, depth + 1);

				return struct;
			}

			// Input options data
			const options = Form.resolveInputOptions(row),
				nData = Form.resolveInputName(options),
				name = nData && nData.name;

			// Clear old inputs when necessary
			if (!hasOwn(foundNames, name)) {
				if (!this.options.noDuplicateNames)
					delete this.inputs[name];

				foundNames[name] = true;
			} else if (nData.fromPath)
				throw new Error(`Cannot connect: duplicate inputs with path "${nData.raw}". To support multiple inputs with the same path, use the 'noDuplicateNames' option`);
			else
				throw new Error(`Cannot connect: duplicate inputs by name "${name}". To support multiple inputs with the same name, use the 'noDuplicateNames' option`);

			options.sourceValues = sourceValues;
			options.input = this.connect(nData, options);
			options.isInputCell = true;

			if (options.type != "hidden")
				struct.push(options);
			return struct;
		};

		this.inputsStruct = connect(rows);
		resolveBlockLayout(this.inputsStruct, null, 0);
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

			this.setValues(src, true, true);
			this.changed = false;
		};

		if (async)
			requestFrame(dispatch);
		else
			dispatch();

		return this;
	}

	disconnect(name) {
		// Finish this off
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

		if (Array.isArray(targets)) {
			for (let i = 0, l = targets.length; i < l; i++)
				send(targets[i]);
		} else if (targets && typeof targets == "object") {
			for (const k in targets)
				send(k);
		} else if (typeof targets == "string")
			send(targets);
	}

	setValues(values, noTrigger = true, forAll = true) {
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

			if (value !== null) {
				inp.setValue(value);
				inp[UPDATE]();
			}

			if (!noTrigger)
				inp[TRIGGER](inp.value);
		}, forAll);

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

	extractOne(inputOrName, target = null, replace = false, withMeta = false) {
		const inp = typeof inputOrName == "string" ?
			this.inputs[inputOrName] :
			inputOrName;

		if (!(inp instanceof Input))
			return;

		const extracted = inp[EXTRACT](null, withMeta);
		let val = withMeta ? extracted.value : extracted,
			source = withMeta ? extracted.source : "native";

		if (inp.nullable && val == null)
			val = null;

		if (!target || val === undefined)
			return extracted;

		switch (source) {
			case "demux":
				for (const k in val) {
					if (hasOwn(val, k))
						set(target, k, val[k]);
				}
				break;

			case "rename":
				set(target, extracted.accessor, val);
				break;

			case "extractor":
			case "native":
				if (typeof inp.path == "string")
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
				break;
		}

		return extracted;
	}

	forEach(callback, forAll = false) {
		if (typeof callback != "function")
			return false;

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

	triggerValidate() {
		this.forEach(inp => {
			inp[TRIGGER_VALIDATE](inp.value);
		});
		return this.valid;
	}

	val(accessor, format = null) {
		let path,
			trie = this.inputNames;

		if (accessor && accessor[0] == "@") {
			path = splitPath(accessor.substring(1));
			trie = this.inputPaths;
		} else
			path = splitPath(accessor);

		const node = trie.matchMax(path);
		if (!node)
			return null;

		const value = node.value.val(format);
		return get(value, path, null, {
			pathOffset: node.depth
		});
	}

	validate() {
		return this.forEach(inp => inp.validate().valid);
	}

	refresh(forAll = false) {
		this.forEach(inp => inp.refresh(), forAll);
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
			(inp.valid || !inp.required);

		const netSize = this.invalidInputs.size - this.invalidNonRequiredInputs.size;

		if (valid)
			this.invalidInputs.delete(inp.name);
		else
			this.invalidInputs.push(inp.name, inp);

		if (!inp.required) {
			if (valid)
				this.invalidNonRequiredInputs.delete(inp.name);
			else
				this.invalidNonRequiredInputs.push(inp.name, inp);
		}

		const newNetSize = this.invalidInputs.size - this.invalidNonRequiredInputs.size;

		if (!netSize ^ !newNetSize)
			this.callHooks("validstatechange", !newNetSize, this.invalidInputs);
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
				Object.assign(runtime, src);
		}

		return runtime;
	}

	res(value, ...args) {
		if (typeof value == "function")
			return value(this.mkRuntime(), ...args);

		return value;
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
		return !(this.invalidInputs.size - this.invalidNonRequiredInputs.size);
	}

	static trigger(inp, ...args) {
		inp[TRIGGER](...args);
	}

	static check(inp, ...args) {
		inp[CHECK](...args);
	}

	static resolveOptions(options) {
		if (typeof options == "function") {
			return {
				validate: options
			};
		}

		options = createOptionsObject(
			options,
			Form.templates,
			`Form has no template by name '${options}'`
		);

		return mergePresets(options, Form.templates, {
			defaultKey: "default",
			keys: ["template", "templates"],
			circular: true
		});
	}

	static resolveGroup(group) {
		if (!isObject(group) || !hasOwn(group, "group"))
			return null;

		const groupOptions = this.resolveInputOptions(group),
			groupOptionsKeys = keys(groupOptions);

		const inject = (opts, depth = 0) => {
			if (Array.isArray(opts)) {
				const out = [];

				for (let i = 0, l = opts.length; i < l; i++)
					out.push(inject(opts[i], depth + 1));

				return out;
			}

			const options = this.resolveInputOptions(opts);

			for (let i = 0, l = groupOptionsKeys.length; i < l; i++) {
				const key = groupOptionsKeys[i];

				switch (key) {
					case "class":
						forEach(groupOptions.class, (c, k) => {
							options.class[k] = joinClass(c, options.class[k]);
						});
						break;

					case "path":
						if (hasOwn(options, "path"))
							options.path = mkPath(groupOptions.path, options.path);
						else
							options.path = groupOptions.path;
						break;

					case "group":
						break;

					case "inline":
						if (!depth)
							options.inline = groupOptions.inline;
						break;

					default:
						if (!hasOwn(options, key))
							options[key] = groupOptions[key];
				}
			}

			return options;
		};

		if (Array.isArray(groupOptions.group)) {
			const out = [];
			
			for (let i = 0, l = groupOptions.group.length; i < l; i++)
				out.push(inject(groupOptions.group[i], 0));

			return out;
		}

		return inject(groupOptions.group, 0);
	}

	static resolveInputOptions(options) {
		let resolved = null;

		if (typeof options == "string") {
			const [_, root, left, op, right] = /\s*(~?)([^#@:\s]*)\s*(?:([#@:]|\ba[st]\b)\s*([^\s]*)\s*)?/.exec(options);
			let key,
				ref,
				id;

			switch (op) {
				case ":":
				case "#":
				case "as":
					key = "name";
					ref = left;
					id = right;
					break;

				case "@":
					key = "path";
					ref = left;
					id = right;
					break;

				default:
					key = "name";
					ref = null;
					id = left;
			}

			if (!ref)
				resolved = {};
			else if (root || !hasOwn(Form.templates, ref)) {
				if (!hasOwn(Form.inputTypes, ref)) {
					console.error(`Form has no input by name '${ref}'`);
					resolved = {};
				} else {
					resolved = {
						type: Form.inputTypes[ref]
					};
				}
			} else
				resolved = this.resolveOptions(ref) || {};

			resolved[key] = id;
		} else
			resolved = this.resolveOptions(options);

		if (resolved.classes)
			resolved.class = resolved.classes;

		resolved.class = typeof resolved.class == "string" ?
			{ input: resolved.class } :
			resolved.class || {};

		return resolved;
	}

	static resolveInputName(nameOrConfig) {
		const dispatch = (name, fromPath = false) => {
			if (!name || typeof name != "string")
				return null;

			return {
				name: fromPath ?
					"@path@:" + name :
					name,
				raw: name,
				fromPath,
				isResolvedInputName: true
			};
		};

		if (isObject(nameOrConfig)) {
			if (nameOrConfig.isResolvedInputName)
				return nameOrConfig;

			if (hasOwn(nameOrConfig, "name"))
				return dispatch(nameOrConfig.name);

			if (typeof nameOrConfig.path == "string")
				return dispatch(nameOrConfig.path, true);

			return null;
		}

		return dispatch(nameOrConfig);
	}

	// Standard function to modify input options
	static mod(options, ...mods) {
		options = Form.resolveOptions(options);

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
					Object.assign(options, Form.resolveOptions(m));
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

	static group(...inputs) {
		return {
			group: inputs
		};
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
			apply: _ => addPreset(Form.presets, name, preset)
		});
	}

	static defineInput(name, config) {
		if (!name || typeof name != "string") {
			console.warn("Cannot define input: name must be a truthy string");
			return null;
		}

		if (!isObject(config)) {
			console.warn(`Cannot define input '${name}': invalid partition target`);
			return null;
		}

		const constr = hasOwn(config, "constructor") && typeof config.constructor == "function" ?
			config.constructor :
			null;

		const proto = {
			finishInit() {
				const sup = Object.getPrototypeOf(Object.getPrototypeOf(this));
				sup.finishSetup.call(this);

				if (hasOwn(config, "finishInit") && typeof config.finishInit == "function")
					config.finishInit.call(this);

				sup.initValue.call(this);
			}
		};

		for (const k in config) {
			if (hasOwn(config, k) && hasOwn(SYMBOLS, k))
				proto[SYMBOLS[k]] = config[k];
		}

		const cls = mkClass({
			name: config.name || "CustomAbstractInput",
			constructor(...args) {
				this.super = mkSuper(this);

				if (constr)
					constr.apply(this, args);

				this.finishInit();
			},
			parameters: [
				{ name: "name", type: "string", required: true },
				{ name: "options", type: Object, required: true },
				{ name: "form", type: Form, required: true }
			],
			proto,
			super: AbstractInput,
			superResolveArgs: ([n, o, f]) => [n, o, f, config.schema]
		});

		return this.define({
			type: "input",
			target: Form.inputTypes,
			name,
			data: cls,
			returnData: true,
			apply: _ => {
				Form.inputTypes[name] = name;
				Form.inputConstructors[name] = cls;
			}
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
			apply = null,
			returnData = false
		} = options;

		const warn = msg => {
			console.warn(msg);
			return returnData ? null : this;
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

		return returnData ? data : this;
	}

	static setDictionary(dictionary) {
		this.dictionary = dictionary || null;
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

Form.inputTypes = inputTypes;
Form.inputConstructors = inputConstructors;
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

// parameters: runtime object
Form.validators = {
	notNull: ({ value }) => value === null ? "Please select a value" : null
};
Form.processors = {};
Form.triggers = {};
Form.updaters = {};
Form.extractors = {};

// parameters: value, reference value
Form.comparators = {
	deep: equals
};

// Global dictionary
Form.dictionary = null;

function isPreset(candidate) {
	if (typeof candidate == "string")
		return true;

	return isObject(candidate) && (
		hasOwn(candidate, "hooks") ||
		hasOwn(candidate, "options") ||
		hasOwn(candidate, "meta") ||
		hasOwn(candidate, "dictionary")
	);
}

function isResolvableInput(candidate) {
	if (typeof candidate == "string")
		return true;

	if (isObject(candidate) && Form.resolveInputName(candidate))
		return true;

	return false;
}

function mkSuper(inst) {
	const proto = Object.getPrototypeOf(Object.getPrototypeOf(inst)),
		proxy = {},
		getters = {},
		assigned = {};
	let p = proto;

	while (p) {
		const names = Object.getOwnPropertyNames(p);

		for (let i = 0, l = names.length; i < l; i++) {
			const name = names[i],
				localProto = p;

			if (hasOwn(assigned, name))
				continue;

			getters[name] = {
				enumerable: true,
				configurable: false,
				get() {
					const descriptor = Object.getOwnPropertyDescriptor(localProto, name);
					if (descriptor && hasOwn(descriptor, "get"))
						return proto[name];

					const value = proto[name];

					if (typeof value == "function")
						return value.bind(inst);
					
					return value;
				}
			};

			assigned[name] = true;
		}

		p = Object.getPrototypeOf(p);
	}

	Object.defineProperties(proxy, getters);
	return proxy;
}
