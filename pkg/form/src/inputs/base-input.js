import {
	sym,
	get,
	inject,
	injectSchema
} from "@qtxr/utils";
import { Hookable } from "@qtxr/bc";
import { isValidKey, isValidWord } from "@qtxr/evt";

// TODO: in next major version, change hook argument order from
// oldValue, newValue to newValue, oldValue

const CHECK = sym("check"),
	TRIGGER = sym("trigger"),
	SELF_TRIGGER = sym("selfTrigger"),
	UPDATE = sym("update"),
	EXTRACT = sym("extract"),
	INJECT = sym("inject"),
	SET_VALUE = sym("setValue");

const initOptionsSchema = {
	name: "string",
	path: "string",
	required: "boolean",
	type: "string",

	initialized: "boolean",
	value: "any",
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

export default class BaseInput extends Hookable {
	constructor(name, options, form, schema = {}) {
		options = options || {};
		super();

		// Constants (during runtime)
		this.name = name;
		this.required = true;
		this.type = "text";

		// State
		this.initialized = false;
		this.value = null;
		this.valid = true;
		this.validationMsg = null;
		this.validationState = "ok";

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
		this.setValue(this.value);

		this.form = form;
		this.default = this.value;
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
				this.value = this.handlers.process(value, this, this.form.inputs);
			else
				this.value = value;

			if (!this.compare(oldVal, this.value)) {
				this.form.callHooks("change", this, oldVal, this.value);
				this.form.callHooks(`change:${this.name}`, this, oldVal, this.value);
				this.callHooks("change", oldVal, this.value);
			}
		}

		this.initialized = true;
		this.form.changed = true;

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

	[UPDATE]() {
		let validationResult = null;
		
		if (typeof this.handlers.validate == "function")
			validationResult = this.handlers.validate(this.value, this, this.form.inputs);

		const validBcVRO = this.required === false && this.form.validateRequiredOnly,
			validBcNullResult = !validationResult || typeof validationResult != "object";

		if (!validBcVRO && typeof validationResult == "string") {
			validationResult = {
				validationMsg: validationResult,
				validationState: "error"
			};
		} else if (validBcVRO || validBcNullResult) {
			validationResult = {
				validationMsg: null,
				validationState: "ok"
			};
		}

		this.validationMsg = validationResult.validationMsg;
		this.validationState = validationResult.validationState;
		this.valid = this.validationState != "error";

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

	[EXTRACT]() {
		if (typeof this.handlers.extract == "function")
			return this.handlers.extract(this.value, this, this.form.inputs);
		else if (typeof this.handlers.extract == "string")
			return get(this.value, this.handlers.extract);
		else
			return this.value;
	}

	[SET_VALUE](value) {
		this.value = this[INJECT](value);
	}

	setValue(value) {
		return this[SET_VALUE](value);
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

	get validate() {
		return this.handlers.validate;
	}

	set validate(handler) {
		this.handlers.validate = handler;
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

	get update() {
		return this[UPDATE];
	}

	set update(handler) {
		this.handlers.update = handler;
	}

	get inject() {
		return this[INJECT];
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

		return typeof this.handlers.if != "function" || !this.handlers.if(
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
	UPDATE,
	EXTRACT,
	INJECT,
	SET_VALUE
};
