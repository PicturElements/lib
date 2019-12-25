import {
	sym,
	get,
	isObj,
	inject,
	injectSchema
} from "@qtxr/utils";
import {
	isValidKey,
	isValidWord
} from "@qtxr/evt";
import { Hookable } from "@qtxr/bc";
import { Formalizer, FormalizerCell } from "@qtxr/uc";

// TODO: in next major version, change hook argument order from
// oldValue, newValue to newValue, oldValue

const CHECK = sym("check"),
	TRIGGER = sym("trigger"),
	SELF_TRIGGER = sym("selfTrigger"),
	VALIDATE = sym("validate"),
	UPDATE = sym("update"),
	INJECT = sym("inject"),
	MERGE_INJECT = sym("mergeInject"),
	OVERRIDE_INJECT = sym("overrideInject"),
	EXTRACT = sym("extract"),
	SELF_EXTRACT = sym("selfExtract");

const initOptionsSchema = {
	name: "string",
	path: "string",
	required: "boolean",
	type: "string",

	initialized: "boolean",
	valid: "boolean",
	validationMsg: "string",
	validationState: "string",

	checkKey: "Object|string|function|RegExp",
	checkWord: "Object|string|function|RegExp",
	validate: "function",
	process: "function",
	trigger: "function",
	update: "function",
	inject: "function",
	extract: "function|string",
	compare: "function|string",
	if: "function|boolean",
	show: "function|boolean",
	disabled: "function|boolean",

	propagate: "any"
};

let dynValId = 0;

export default class BaseInput extends Hookable {
	constructor(name, options, form, schema = {}) {
		options = options || {};
		super();

		// Constants (during runtime)
		this.form = form;
		this.name = name;
		this.required = true;
		this.type = "text";

		// State
		this.initialized = false;
		this.changed = false;
		this.valid = true;
		this.validationMsg = null;
		this.validationState = "ok";
		
		// Dynamic value state
		this.dynamicValue = {
			id: dynValId++,
			value: null,
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
		}

		// Handlers
		this.handlers = {};
		this.checkKey = null;
		this.checkWord = null;
		this.validate = null;
		this.process = null;
		this.trigger = null;
		this.update = null;
		this.inject = null;
		this.extract = null;
		this.compare = null;
		this.if = null;
		this.show = null;
		this.disabled = null;

		// Propagation data
		this.propagate = null;

		inject(this, options, {
			schema: injectSchema(initOptionsSchema, schema, "override|cloneTarget"),
			strictSchema: true,
			override: true
		});

		this.hookAll(options.hooks);
		this.default = options.value;
		this.setValue(options.value);
	}

	[CHECK](evt) {
		if (!isValidKey(evt, this.handlers.checkKey))
			evt.preventDefault();
		else if (!isValidWord(evt, this.handlers.checkWord))
			evt.preventDefault();
	}

	[TRIGGER](value) {
		// If value is null, don't update internal value
		if (value !== null) {
			// If the value is undefined, set it to null to denote an empty value
			if (value === undefined)
				value = null;

			const oldVal = this.value;

			if (typeof this.handlers.process == "function")
				this.updateValue(this.handlers.process(value, this, this.form.inputs));
			else
				this.updateValue(value);

			if (!this.compare(oldVal, this.value)) {
				this.form.callHooks("change", this, oldVal, this.value);
				this.form.callHooks(`change:${this.name}`, this, oldVal, this.value);
				this.callHooks("change", oldVal, this.value);
				this.changed = true;
				this.form.changed = true;
			}
		}

		this.initialized = true;

		this[SELF_TRIGGER](this.value);
		this.form.propagateMap = {};
		
		this.form.callHooks("trigger", this, this.value);
		this.form.callHooks(`trigger:${this.name}`, this, this.value);
		this.callHooks("sourceTrigger");

		if (!this.form.updateInitialized)
			this.form.callHooks("updated", this.form.inputs);
	}

	[SELF_TRIGGER](value) {
		if (typeof this.handlers.trigger == "function")
			this.handlers.trigger(value, this, this.form.inputs);

		this[UPDATE]();
		this.form.propagate(this.propagate);
		this.callHooks("trigger");
	}

	[VALIDATE]() {
		let validationResult = null;
		
		if (typeof this.handlers.validate == "function")
			validationResult = this.handlers.validate(this.value, this, this.form.inputs);

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

	[UPDATE]() {
		const validationResult = this[VALIDATE]();

		this.validationMsg = validationResult.validationMsg;
		this.validationState = validationResult.validationState;
		this.valid = validationResult.valid;

		if (typeof this.handlers.update == "function")
			this.handlers.update(this, this.form.inputs);

		this.form.callHooks("update", this);
		this.form.callHooks(`update:${this.name}`, this);
		this.callHooks("update");
	}

	[INJECT](value) {
		if (typeof this.handlers.inject == "function")
			return this.handlers.inject(value);

		return value;
	}

	[MERGE_INJECT](value) {
		this.dynamicValue.cache = null;
		this.dynamicValue.cacheValid = false;

		if (this.dynamicValue.value instanceof FormalizerCell) {
			if (value instanceof FormalizerCell)
				this.dynamicValue.value.data = value.data;
			else
				this.dynamicValue.value.data = value;
			
			value = this.dynamicValue.value;
		} else if (value instanceof FormalizerCell)
			value = value.data;
		else if (isObj(value)) {
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

	[EXTRACT]() {
		return this[SELF_EXTRACT](this.value);
	}

	[SELF_EXTRACT](value) {
		const val = this.dynamicValue.value,
			isFunctionalHandler = typeof this.handlers.extract == "function",
			isGetterHandler = typeof this.handlers.extract == "string",
			hasHandler = isFunctionalHandler || isGetterHandler;

		if (val instanceof FormalizerCell)
			value = hasHandler ? val.data : val.transform();
		else if (!this.dynamicValue.tracked || !isObj(val))
			value = val;
		else {
			value = inject(null, val, {
				inject: v => {
					if (!(v instanceof FormalizerCell))
						return v;

					return hasHandler ? v.data : v.transform();
				}
			}, "circular");
		}

		if (isFunctionalHandler)
			return this.handlers.extract(value, this, this.form.inputs);
		if (isGetterHandler)
			return get(value, this.handlers.extract);
		
		return value;
	}

	setValue(value) {
		this.dynamicValue.value = this[OVERRIDE_INJECT](value);
		return value;
	}

	updateValue(value) {
		this.dynamicValue.value = this[MERGE_INJECT](value);
		return value;
	}

	// Aliases for public handlers
	get checkKey() {
		return this.handlers.checkKey;
	}

	set checkKey(handler) {
		this.handlers.checkKey = mkChecker(handler, "check");
	}

	get checkWord() {
		return this.handlers.checkWord;
	}

	set checkWord(handler) {
		this.handlers.checkWord = mkChecker(handler, "validate");
	}

	get process() {
		return this.handlers.process;
	}

	set process(handler) {
		this.handlers.process = handler;
	}

	get compare() {
		return this.handlers.compare;
	}

	set compare(handler) {
		this.handlers.compare = mkComparator(handler);
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

	// Dynamic state
	get exists() {
		if (typeof this.handlers.if == "boolean")
			return this.handlers.if;

		return typeof this.handlers.if != "function" || this.handlers.if(
			this.value,
			this.form,
			this.form.inputs
		);
	}

	set exists(handler) {
		this.handlers.if = handler;
	}

	get visible() {
		if (this.handlers.if === false)
			return false;

		if (typeof this.handlers.show == "boolean")
			return this.handlers.show;

		const val = this.value,
			form = this.form,
			inps = this.form.inputs;

		if (typeof this.handlers.if == "function" && !this.handlers.if(val, form, inps))
			return false;

		if (typeof this.handlers.show == "function" && !this.handlers.show(val, form, inps))
			return false;

		return true;
	}

	set visible(handler) {
		this.handlers.show = handler;
	}

	get disabled() {
		if (typeof this.handlers.disabled == "boolean")
			return this.handlers.disabled;

		if (typeof this.handlers.disabled != "function")
			return false;

		return this.handlers.disabled(
			this.value,
			this.form,
			this.form.inputs
		);
	}

	set disabled(handler) {
		this.handlers.disabled = handler;
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
		this.dynamicValue.value = this[OVERRIDE_INJECT](value);
	}

	static get formalize() {
		this.formalizer = new Formalizer();
		return this.formalizer;
	}
}

function mkChecker(checker, checkerKey) {
	if (checker && checker.constructor == Object)
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

function mkComparator(precursor) {
	switch (typeof precursor) {
		case "string":
			return (a, b) => Boolean(a && b) && a[precursor] == b[precursor];
		case "function":
			return (a, b) => precursor(a, b);
		default:
			return (a, b) => a == b;
	}
}

export {
	CHECK,
	TRIGGER,
	SELF_TRIGGER,
	VALIDATE,
	UPDATE,
	EXTRACT,
	SELF_EXTRACT,
	INJECT
};
