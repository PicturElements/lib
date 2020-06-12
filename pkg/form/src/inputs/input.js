import {
	sym,
	get,
	isObj,
	isObject,
	hash,
	then,
	alias,
	clone,
	equals,
	hasOwn,
	inject,
	distance,
	isPrimitive,
	injectSchema,
	compilePatternMatcher,
	compilePatternMatcherGroup
} from "@qtxr/utils";
import {
	isValidKey,
	isValidWord,
	runPattern
} from "@qtxr/evt";
import { Hookable } from "@qtxr/bc";
import {
	Formalizer,
	FormalizerCell
} from "@qtxr/uc";

const CHECK = sym("check"),
	TRIGGER = sym("trigger"),
	SELF_TRIGGER = sym("selfTrigger"),
	VALIDATE = sym("validate"),
	SELF_VALIDATE = sym("selfValidate"),
	TRIGGER_VALIDATE = sym("triggerValidate"),
	UPDATE = sym("update"),
	REFRESH = sym("refresh"),
	INJECT = sym("inject"),
	MERGE_INJECT = sym("mergeInject"),
	OVERRIDE_INJECT = sym("overrideInject"),
	EXTRACT = sym("extract"),
	SELF_EXTRACT = sym("selfExtract"),
	DISPATCH_VALUE = sym("dispatchValue"),
	DISPATCH_CHANGE = sym("dispatchChange"),
	DISPATCH_CHANGESTATECHANGE = sym("dispatchChangestatechange"),
	DISPATCH_CHANGED = sym("dispatchChanged"),
	DISPATCH_VALID = sym("setValid");

const ROOT_HOOK_REGEX = /^(?:@|on)(.+)$/;

const INIT_OPTIONS_SCHEMA = {
	name: "string",
	path: "string",
	required: "boolean",
	type: "string",
	format: "string",
	bare: "boolean",

	checkKey: "Object|string|function|RegExp",
	checkWord: "Object|string|function|RegExp",
	compare: "function|string|number|Array",
	hash: "function|string|boolean",
	validate: "function",
	process: "function",
	trigger: "function",
	update: "function",
	refresh: "function",
	inject: "function",
	extract: "function|string",
	if: "boolean|function",
	show: "boolean|function",
	disabled: "boolean|function",
	readonly: "boolean|function",
	pattern: "string|Array",
	patterns: "Array|Object",

	propagate: "any"
};

let dynValId = 0;

export default class Input extends Hookable {
	constructor(name, options, form, schema = {}) {
		options = options || {};
		super({
			hookable: {
				noOwnerArg: true
			}
		});

		this._options = options;
		this._schema = schema;

		// Constants (during runtime)
		this.form = form;
		this.name = name;
		this.required = true;
		this.type = "text";
		this.nullable = false;

		// State
		this.instantiated = false;
		this.modified = false;
		this.validationMsg = null;
		this.validationState = "ok";
		this.changeData = {
			value: null,
			changed: false,
			valid: false,
			visible: null
		};
		
		// Dynamic value state
		this.dynamicValue = {
			id: dynValId++,
			value: null,
			pendingValue: null,
			resolves: 0,
			resolving: false,
			formalizer: this.constructor.formalizer,
			cache: null,
			cacheValid: false,
			tracked: 0
		};

		if (this.dynamicValue.formalizer) {
			this.vt = val => {
				this.dynamicValue.tracked++;
				return this.dynamicValue.formalizer.transform(val);
			};
		} else
			this.vt = _ => console.warn("This input does not provide a formalizer");

		// Set handlers / dynamic state
		this.handlers = {};
		this.checkKey = null;
		this.checkWord = null;
		this.compare = null;
		this.hash = null;
		this.validate = null;
		this.process = null;
		this.trigger = null;
		this.triggerValidate = null;
		this.update = null;
		this.refresh = null;
		this.inject = null;
		this.extract = null;
		this.if = null;
		this.show = null;
		this.disabled = false;
		this.readonly = false;
		this.pattern = null;
		this.patterns = null;

		// Propagation data
		this.propagate = null;

		// Don't run this on derived classes with their own finishInit
		// method as they will want to run this at the end of their creation,
		// and might need to finish init manually
		if (this.finishInit == Input.prototype.finishInit)
			this.finishInit();
	}

	finishInit() {
		this.finishSetup();
		this.initValue();
	}

	finishSetup() {
		inject(this, this._options, {
			schema: injectSchema(INIT_OPTIONS_SCHEMA, this._schema, "override|cloneTarget"),
			strictSchema: true,
			override: true
		});

		const rootHooks = {};
		for (const k in this._options) {
			if (!hasOwn(this._options, k))
				continue;

			const ex = ROOT_HOOK_REGEX.exec(k);
			if (!ex)
				continue;

			rootHooks[ex[1]] = this._options[k];
		}

		this.hookAll(rootHooks);
		this.hookAll(this._options.hooks);
		this.default = this._options.value;
	}

	initValue() {
		this.setValue(this._options.value);
		this.instantiated = true;
	}

	[CHECK](evt) {
		if (!isValidKey(evt, this.handlers.checkKey))
			evt.preventDefault();
		else if (!isValidWord(evt, this.handlers.checkWord))
			evt.preventDefault();
	}

	[TRIGGER](value) {
		let oldVal = this.value,
			newVal = value;

		const dispatch = (o, n) => {
			this[SELF_TRIGGER](n);
			this.form.propagateMap = {};
			
			this.callFormHooks("trigger", n, o);
			this.callFormHooks(`trigger:${this.name}`, n, o);
			this.callHooks("sourceTrigger", n, o);
	
			if (!this.form.updateInitialized)
				this.callFormHooks("updated");
		};

		// If the value is undefined, set it to null to denote an empty value
		if (value === undefined)
			value = null;

		if (typeof this.handlers.process == "function") {
			newVal = this.updateValue(
				this.handlers.process(this.mkRuntimeWithValue(value))
			);
		} else
			newVal = this.updateValue(value);

		return then(newVal, val => {
			dispatch(oldVal, val);
			return val;
		});
	}

	[SELF_TRIGGER](value) {
		if (typeof this.handlers.trigger == "function")
			this.handlers.trigger(this.mkRuntimeWithValue(value));

		this[UPDATE]();
		this.form.propagate(this.propagate);
		this.callHooks("trigger");
	}

	[VALIDATE]() {
		let validationResult = null;
		
		if (typeof this.handlers.validate == "function")
			validationResult = this.handlers.validate(this.mkRuntime());

		const validBcVRO = this.required === false && this.form.validateRequiredOnly,
			validBcNullResult = !validationResult || typeof validationResult != "object";

		if (!validBcVRO && typeof validationResult == "string") {
			validationResult = {
				valid: false,
				validationMsg: validationResult,
				validationState: "error"
			};
		} else if (validBcVRO || validBcNullResult) {
			validationResult = {
				valid: true,
				validationMsg: null,
				validationState: "ok"
			};
		}

		return validationResult;
	}

	[SELF_VALIDATE]() {
		const validationResult = this[VALIDATE]();
		this.validationMsg = validationResult.validationMsg;
		this.validationState = validationResult.validationState;

		if (validationResult.valid != this.changeData.valid) {
			this.callFormHooks(`validstatechange:${this.name}`, validationResult.valid);
			this.callHooks("validstatechange", validationResult.valid);
			this.valid = validationResult.valid;
		}
	}

	[TRIGGER_VALIDATE]() {
		if (typeof this.handlers.triggerValidate == "function")
			this.handlers.triggerValidate(this.mkRuntime());

		this[SELF_VALIDATE]();
		this[UPDATE]();
		return this.valid;
	}

	[UPDATE]() {
		if (typeof this.handlers.update == "function")
			this.handlers.update(this.mkRuntime());

		this.callFormHooks("update");
		this.callFormHooks(`update:${this.name}`);
		this.callHooks("update");
	}

	[REFRESH]() {
		if (typeof this.handlers.refresh == "function")
			this.handlers.refresh(this.mkRuntime());

		this.callFormHooks("refresh");
		this.callFormHooks(`refresh:${this.name}`);
		this.callHooks("refresh");
	}

	[INJECT](value) {
		if (typeof this.handlers.inject == "function") {
			return this.handlers.inject(this.mkRuntime({
				value
			}));
		}

		return value;
	}

	[MERGE_INJECT](value) {
		this.dynamicValue.cache = null;
		this.dynamicValue.cacheValid = false;

		if (this.dynamicValue.value instanceof FormalizerCell) {
			this.dynamicValue.value.data = resolveValue(value);
			value = this.dynamicValue.value;
		} else if (value instanceof FormalizerCell)
			value = value.data;
		else if (isObj(value)) {
			if (value == this.dynamicValue.value)
				value = clone(value, "circular");

			inject(value, this.dynamicValue.value, {
				inject: (v, key, targ) => {
					if (v instanceof FormalizerCell) {
						v.data = targ[key].data;
						return v;
					}

					return targ[key];
				},
				circular: true,
				override: true,
				restrictiveTarget: true
			});
		}

		return value;
	}

	[OVERRIDE_INJECT](value) {
		this.dynamicValue.tracked = 0;
		this.dynamicValue.cache = null;
		this.dynamicValue.cacheValid = false;

		return this[INJECT](value);
	}

	[EXTRACT](format = null, withMeta = false) {
		return this[SELF_EXTRACT](this.value, format, withMeta);
	}

	[SELF_EXTRACT](value, format = null, withMeta = false) {
		const val = this.dynamicValue.value,
			isFunctionalHandler = typeof this.handlers.extract == "function",
			isGetterHandler = typeof this.handlers.extract == "string",
			hasHandler = isFunctionalHandler || isGetterHandler;

		if (!format && typeof this.format == "string")
			format = this.format;

		if (val instanceof FormalizerCell)
			value = hasHandler ? val.data : val.transform(format);
		else if (!this.dynamicValue.tracked || !isObj(val))
			value = val;
		else {
			value = inject(null, val, {
				inject: v => {
					if (!(v instanceof FormalizerCell))
						return v;

					return hasHandler ?
						v.data :
						v.transform(format);
				}
			}, "circular");
		}

		if (isFunctionalHandler) {
			let demuxed = false;
			const demuxValue = {};

			const extracted = this.handlers.extract(
				this.mkRuntime({
					value,
					demux(dataOrKey, data) {
						demuxed = true;

						if (typeof dataOrKey == "string") {
							demuxValue[dataOrKey] = data;
							return demuxValue;
						}

						if (!isObject(dataOrKey))
							throw new TypeError("Cannot demultiplex: non-object data");

						Object.assign(demuxValue, dataOrKey);
						return demuxValue;
					}
				})
			);

			if (withMeta) {
				return {
					source: demuxed ? "demux" : "extractor",
					value: extracted
				};
			}

			return extracted;
		}
		
		if (isGetterHandler)
			value = get(value, this.handlers.extract);

		if (withMeta) {
			return {
				source: "native",
				value
			};
		}
		
		return value;
	}

	[DISPATCH_VALUE](value, oldValue) {
		const newValue = resolveValue(value);
		this.dynamicValue.value = value;

		if (newValue === null || this.changeData.value === null)
			this.changeData.value = newValue;

		if (this.instantiated && !cmp(this, oldValue, newValue)) {
			const changed = !cmp(this, this.changeData.value, newValue);
			this[DISPATCH_CHANGE](newValue, oldValue);
			this[DISPATCH_CHANGESTATECHANGE](changed, newValue, oldValue);
			this.modified = true;
		}

		this[SELF_VALIDATE]();
	}

	[DISPATCH_CHANGE](newValue, oldValue) {
		this.callFormHooks("change", newValue, oldValue);
		this.callFormHooks(`change:${this.name}`, newValue, oldValue);
		this.callHooks("change", newValue, oldValue);
	}

	[DISPATCH_CHANGESTATECHANGE](changed, newValue, oldValue) {
		if (changed == this.changeData.changed)
			return;

		this.callFormHooks(`changestatechange:${this.name}`, changed, newValue, oldValue);
		this.callHooks("changestatechange", changed, newValue, oldValue);
		this.changed = changed;
	}

	[DISPATCH_CHANGED](changed) {
		if (!changed)
			this.changeData.value = resolveValue(this.dynamicValue.value);
	}

	[DISPATCH_VALID](valid) {}

	val(format = null) {
		return this[EXTRACT](format);
	}

	clear() {
		this.modified = false;
		this.setValue(this.default);
		this.changed = false;
	}

	// Semi-private methods
	setValue(value) {
		const oldValue = resolveValue(this.dynamicValue.value),
			newValue = this[OVERRIDE_INJECT](value);

		return then(newValue, val => {
			this[DISPATCH_VALUE](val, oldValue);
			return val;
		});
	}

	updateValue(value) {
		const oldValue = resolveValue(this.dynamicValue.value),
			newValue = this[MERGE_INJECT](value);

		return then(newValue, val => {
			this[DISPATCH_VALUE](val, oldValue);
			return val;
		});
	}

	mkRuntime(...sources) {
		return this.form.mkRuntime({
			input: this,
			value: this.value
		}, ...sources);
	}

	mkRuntimeWithValue(value) {
		return this.mkRuntime({
			value
		});
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

	callFormHooks(partitionName, ...args) {
		this.form.callHooksWithCustomRuntime(
			partitionName,
			this.mkRuntime({
				partitionName
			})
		)(...args);
	}

	propagateVisibility(visible) {
		if (typeof visible != "boolean" || visible == this.changeData.visible)
			return visible;

		if (this.changeData.visible !== null) {
			this.callFormHooks("visibilitychange", visible);
			this.callFormHooks(`visibilitychange:${this.name}`, visible);
			this.callHooks("visibilitychange", visible);
		}

		this.form.updateChanged(this, visible && this.changeData.changed);
		this.form.updateValid(this, visible ? this.changeData.valid : true);
		this.changeData.visible = visible;
		return visible;
	}

	resolveOptionSelection(resolveOpts) {
		const {
			value,
			resolve,
			resolveOptionValue = null,
			accessor = null,
			passThroughValue = false,
			singular = true
		} = resolveOpts;

		const selection = [];
		let injectAccessor;

		switch (typeof accessor) {
			case "string":
				injectAccessor = accessor;
				break;

			case "function":
				injectAccessor = accessor(this.mkRuntime());
				break;

			default:
				injectAccessor = this.inferAccessor();
		}

		const send = (data, success = true, inferred = false) => {
			if (!success || inferred)
				this.setPendingValue(value);

			if (singular) {
				return {
					success,
					inferred,
					option: data
				};
			}

			return {
				success,
				inferred,
				selection: data
			};
		};

		const compare = (val, opts, idx) => {
			const optionValue = typeof resolveOptionValue == "function" ?
				resolveOptionValue(opts[idx], idx, opts) :
				opts[idx];

			if (injectAccessor) {
				if (get(optionValue, injectAccessor) == value)
					return true;
			} else {
				const comparison = this.compare(val, optionValue, true);
				if (comparison === true)
					return true;

				return comparison;
			}
		};

		const getIdx = (val, opts) => {
			let min = Infinity,
				idx = -1;

			for (let i = 0, l = opts.length; i < l; i++) {
				const comparison = compare(val, opts, i);

				if (comparison === true)
					return i;

				if (typeof comparison == "number" && comparison < min) {
					min = comparison;
					idx = i;
				}
			}

			return idx;
		};

		const collect = (val, opts) => {
			for (let i = 0, l = opts.length; i < l; i++) {
				const opt = opts[i];

				if (opt && opt.type == "context" && opt.context) {
					if (collect(val, opt.context.options))
						return true;
				} else {
					const comparison = compare(val, opts, i);
					if (comparison === true || comparison === 0) {
						selection.push(opts[i]);
						return true;
					}
				}
			}

			return false;
		};

		const dispatch = opts => {
			this.dynamicValue.resolving = false;
			this.dynamicValue.resolves++;
			this.clearPendingValue();
			if (!Array.isArray(opts))
				opts = [];

			if (singular) {
				const idx = getIdx(value, opts);
				if (idx > -1)
					return send(opts[idx]);

				if (this.autoSet && opts.length)
					return send(opts[0], true, true);

				if (passThroughValue)
					return send(value, false);
				return send(null, false);
			}

			if (Array.isArray(value)) {
				for (let i = 0, l = value.length; i < l; i++)
					collect(value[i], opts);
			}

			return send(selection);
		};

		if (value != null || this.autoSet || this.dynamicValue.resolves) {
			this.dynamicValue.resolving = true;
			const options = resolve(this.mkRuntime());
			return then(options, dispatch);
		}

		if (passThroughValue)
			return send(value, false);

		if (singular)
			return send(null, false);
		return send(selection, false);
	}

	inferAccessor() {
		const accessor = typeof this.handlers.inject == "string" ?
			this.handlers.inject :
			this.handlers.extract;
	
		if (typeof accessor == "string")
			return accessor;
	
		return null;
	}

	setPendingValue(value) {
		this.dynamicValue.pendingValue = value;
	}

	clearPendingValue() {
		this.dynamicValue.pendingValue = null;
	}

	resolvePendingValue(callback) {
		const val = this.dynamicValue.pendingValue;

		this.clearPendingValue();
		const changed = this.changed;

		return then(callback(val), val => {
			this.changed = changed;
			return val;
		});
	}

	// Aliases for public handlers
	get checkKey() {
		return this.handlers.checkKey;
	}

	set checkKey(handler) {
		this.handlers.checkKey = Input.mkChecker(handler, "check");
	}

	get checkWord() {
		return this.handlers.checkWord;
	}

	set checkWord(handler) {
		this.handlers.checkWord = Input.mkChecker(handler, "validate");
	}

	get compare() {
		return this.handlers.compare;
	}

	set compare(handler) {
		this.handlers.compare = Input.mkComparator(this, handler);
	}

	get hash() {
		return this.handlers.hash;
	}

	set hash(handler) {
		this.handlers.hash = Input.mkHasher(this, handler);
	}

	get pattern() {
		return this.handlers.pattern;
	}

	set pattern(pattern) {
		this.handlers.pattern = Input.mkPatternMatcher(pattern, "pattern", compilePatternMatcher);
	}

	get patterns() {
		return this.handlers.patterns;
	}

	set patterns(pattern) {
		this.handlers.patterns = Input.mkPatternMatcher(pattern, "patterns", compilePatternMatcherGroup);
	}

	get if() {
		return this.handlers.if;
	}

	set if(handler) {
		this.handlers.if = handler;
	}

	get show() {
		return this.handlers.show;
	}

	set show(handler) {
		this.handlers.show = handler;
	}

	// Aliases for private handlers
	get trigger() {
		return this[TRIGGER];
	}

	set trigger(handler) {
		this.handlers.trigger = handler;
	}

	get triggerValidate() {
		return this[TRIGGER_VALIDATE];
	}

	set triggerValidate(handler) {
		this.handlers.triggerValidate = handler;
	}

	get process() {
		return this.handlers.process;
	}

	set process(handler) {
		this.handlers.process = handler;
	}

	get check() {
		return this[CHECK];
	}

	set check(handler) {
		this.handlers.check = handler;
	}

	get validate() {
		return this[VALIDATE];
	}

	set validate(handler) {
		this.handlers.validate = handler;
	}

	get update() {
		return this[UPDATE];
	}

	set update(handler) {
		this.handlers.update = handler;
	}

	get inject() {
		return this[OVERRIDE_INJECT];
	}

	set inject(handler) {
		this.handlers.inject = handler;
	}

	get extract() {
		return this[EXTRACT];
	}

	set extract(handler) {
		this.handlers.extract = handler;
	}

	get refresh() {
		return this[REFRESH];
	}

	set refresh(handler) {
		this.handlers.refresh = handler;
	}

	// Dynamic state
	get exists() {
		if (typeof this.handlers.if == "boolean")
			return this.propagateVisibility(this.handlers.if);

		return this.propagateVisibility(
			typeof this.handlers.if != "function" || this.handlers.if(this.mkRuntime())
		);
	}

	set exists(handler) {
		this.handlers.if = handler;
	}

	get visible() {
		if (this.handlers.if === false)
			return this.propagateVisibility(false);

		if (typeof this.handlers.show == "boolean")
			return this.propagateVisibility(this.handlers.show);

		const runtime = this.mkRuntime();

		if (typeof this.handlers.if == "function" && !this.handlers.if(runtime))
			return this.propagateVisibility(false);

		if (typeof this.handlers.show == "function" && !this.handlers.show(runtime))
			return this.propagateVisibility(false);

		return this.propagateVisibility(true);
	}

	set visible(handler) {
		this.handlers.show = handler;
	}

	get disabled() {
		if (typeof this.handlers.disabled == "boolean")
			return this.handlers.disabled;

		if (typeof this.handlers.disabled != "function")
			return false;

		return this.handlers.disabled(this.mkRuntime());
	}

	set disabled(handler) {
		this.handlers.disabled = handler;
	}

	get readonly() {
		if (typeof this.handlers.readonly == "boolean")
			return this.handlers.readonly;

		if (typeof this.handlers.readonly != "function")
			return false;

		return this.handlers.readonly(this.mkRuntime());
	}

	set readonly(handler) {
		this.handlers.readonly = handler;
	}

	get value() {
		const val = this.dynamicValue.value;
		let cachedValue = this.dynamicValue.cache;

		if (!this.dynamicValue.tracked)
			return val;

		if (this.dynamicValue.cacheValid)
			return cachedValue;

		if (val instanceof FormalizerCell)
			cachedValue = val.data;
		else if (!isObj(val))
			cachedValue = val;
		else {
			cachedValue = inject(null, val, {
				inject: v => (v instanceof FormalizerCell) ? v.data : v
			}, "circular");
		}
	
		this.dynamicValue.cache = cachedValue;
		this.dynamicValue.cacheValid = true;
		return cachedValue;
	}

	set value(value) {
		this.setValue(value);
	}

	get changed() {
		return this.changeData.changed;
	}

	set changed(changed) {
		if (changed != this.changeData.changed)
			this[DISPATCH_CHANGED](changed);

		this.changeData.changed = changed;
		this.form.updateChanged(this, changed);
	}

	get valid() {
		return this.changeData.valid;
	}

	set valid(valid) {
		if (valid != this.changeData.valid)
			this[DISPATCH_VALID](valid);

		this.changeData.valid = valid;
		this.form.updateValid(this, valid);
	}

	static get formalize() {
		this.formalizer = new Formalizer();
		return this.formalizer;
	}

	// Object|string|function|RegExp
	static mkChecker(checker, checkerKey) {
		if (isObject(checker))
			return checker;
		else if (typeof checker == "string")
			return checker;
		else if (typeof checker == "function" || checker instanceof RegExp) {
			return {
				[checkerKey]: checker
			};
		}
	
		return null;
	}

	// function|string|number|Array
	static mkComparator(input, precursor) {
		let acc = typeof precursor == "string" ?
			precursor :
			null;
	
		if (Array.isArray(precursor)) {
			const arr = precursor;
	
			for (let i = 0, l = arr.length; i < l; i++) {
				if (typeof arr[i] == "string")
					acc = arr[i];
				else
					precursor = arr[i];
			}
		}
	
		return (a, b, smartResolve = false) => {
			const aNullish = a == null,
				bNullish = b == null;
	
			if (a === b && aNullish && bNullish)
				return true;
	
			// Eliminate bugs arising from null value access
			if (aNullish != bNullish)
				return false;
	
			// Eliminate bugs arising from failed NaN comparisons
			const aNaN = typeof a == "number" && isNaN(a),
				bNaN = typeof b == "number" && isNaN(b);
	
			if (aNaN && bNaN)
				return true;
	
			if (aNaN != bNaN)
				return false;
	
			switch (typeof precursor) {
				case "string": {
					const [a2, b2] = resolveCmp(a, b, acc, smartResolve);
					return a2 === b2;
				}
	
				case "function":
					if (acc != null) {
						return precursor(
							...resolveCmp(a, b, acc, smartResolve)
						);
					}
	
					return precursor(a, b);
	
				case "number": {
					const accessor = acc == null ?
						input.inferAccessor() :
						acc;

					const [a2, b2] = resolveCmp(a, b, accessor, smartResolve);
	
					if (equals(a2, b2, "circular"))
						return 0;
	
					const ta = typeof a2,
						tb = typeof b2;
	
					if (ta != tb)
						return Infinity;
	
					let score = Infinity;
	
					switch (ta) {
						case "string":
							score = distance(a2, b2, {
								maxDistance: precursor
							});
							break;
	
						case "number":
							score = Math.abs(b2 - a2);
							break;
					}
	
					if (isNaN(score) || score > precursor)
						return Infinity;
	
					return score;
				}
	
				default: {
					const accessor = acc == null ?
						input.inferAccessor() :
						acc;

					if (accessor != null) {
						const [a2, b2] = resolveCmp(a, b, accessor, smartResolve);
						return a2 === b2;
					}
	
					return equals(a, b, "circular");
				}
			}
		};
	}

	// function|string|boolean
	static mkHasher(input, precursor) {
		switch (typeof precursor) {
			case "function":
				return value => precursor(value);
	
			case "string":
				return value => hash(get(value, precursor));
	
			case "boolean":
				return precursor ?
					value => hash(value) :
					_ => null;
	
			default:
				return value => {
					const accessor = input.inferAccessor();
					if (accessor != null)
						return hash(get(value, accessor));
	
					return null;
				};
		}
	}

	// string|Array (type = "pattern")
	// Array|Object (type = "patterns")
	static mkPatternMatcher(pattern, type, compiler) {
		if (!pattern)
			return null;
	
		const p = compiler(pattern);
		return (evt, args) => {
			return runPattern(evt, Object.assign({
				[type]: p
			}, args));
		};
	}
}

alias(Input.prototype, {
	hook: "on",
	unhook: "off"
});

function resolveValue(value) {
	if (value instanceof FormalizerCell)
		return value.data;

	return value;
}

function cmp(input, a, b, smartResolve = false) {
	const comparison = input.compare(a, b, smartResolve);
	if (typeof comparison == "number")
		return !comparison;

	return Boolean(comparison);
}

function resolveCmp(a, b, accessor, smartResolve = false) {
	if (!accessor)
		return [a, b];

	if (!smartResolve || typeof a == typeof b)
		return [get(a, accessor), get(b, accessor)];

	return [
		isPrimitive(a) ? a : get(a, accessor),
		isPrimitive(b) ? b : get(b, accessor)
	];
}

export {
	CHECK,
	TRIGGER,
	SELF_TRIGGER,
	VALIDATE,
	SELF_VALIDATE,
	TRIGGER_VALIDATE,
	UPDATE,
	REFRESH,
	INJECT,
	MERGE_INJECT,
	OVERRIDE_INJECT,
	EXTRACT,
	SELF_EXTRACT,
	DISPATCH_VALUE,
	DISPATCH_CHANGE,
	DISPATCH_CHANGESTATECHANGE,
	DISPATCH_CHANGED,
	DISPATCH_VALID
};
