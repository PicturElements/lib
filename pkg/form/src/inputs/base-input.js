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
	extract: "function|string",
	insert: "function",
	compare: "function",

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
		this.checkKey = null;
		this.checkWord = null;
		this.validate = null;
		this.process = null;
		this.trigger = null;
		this.update = null;
		this.extract = null;
		this.insert = null;
		this.compare = null;

		// Propagation data
		this.propagate = null;

		inject(this, options, {
			schema: injectSchema(initOptionsSchema, schema, "override|cloneTarget"),
			strictSchema: true,
			override: true
		});

		this.hookAll(options.hooks);
		this.checkKey = mkChecker(this.checkKey, "check");
		this.checkWord = mkChecker(this.checkWord, "validate");
		this.compare = mkComparator(this.compare);

		this.form = form;
		this.default = this.value;
	}

	[CHECK](evt) {
		if (!isValidKey(evt, this.checkKey))
			evt.preventDefault();
		else if (!isValidWord(evt, this.checkWord))
			evt.preventDefault();
	}

	[TRIGGER](value) {
		// If value is null, don't update internal value
		if (value !== null) {
			// If the value is undefined, set it to null to denote an empty value
			if (value === undefined)
				value = null;

			const oldVal = this.value;

			if (typeof this.process == "function")
				this.value = this.process(value, this, this.form.inputs);
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
	}

	[SELF_TRIGGER](value) {
		if (typeof this.trigger == "function")
			this.trigger(value, this, this.form.inputs);

		this[UPDATE]();
		this.form.propagate(this.propagate);
		this.callHooks("trigger");
	}

	[UPDATE]() {
		let validationResult = null;
		
		if (typeof this.validate == "function")
			validationResult = this.validate(this.value, this, this.form.inputs);

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

		if (typeof this.update == "function")
			this.update(this, this.form.inputs);

		this.form.callHooks("update", this);
		this.form.callHooks(`update:${this.name}`, this);
		this.callHooks("update");
	}

	[EXTRACT]() {
		if (typeof this.extract == "function")
			return this.extract(this.value, this, this, this.form.inputs);
		else if (typeof this.extract == "string")
			return get(this.value, this.extract);
		else
			return this.value;
	}

	[INJECT](value) {
		if (typeof this.inject == "function")
			return this.inject(value);

		return value;
	}

	[SET_VALUE](value) {
		this.value = this[INJECT](value);
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
