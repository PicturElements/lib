import { sym } from "@qtxr/utils";
import { Hookable } from "@qtxr/bc";
import { isValidKey, isValidWord } from "@qtxr/evt";

const UPDATE = sym("update"),
	CHECK = sym("check"),
	TRIGGER = sym("trigger"),
	SELF_TRIGGER = sym("selfTrigger");

export default class Input extends Hookable {
	constructor(name, options, form) {
		super();

		this.name = name;
		this.initialized = false;
		this.required = true;
		this.value = null;
		this.type = "text";
		this.valid = true;
		this.validationMsg = null;
		this.validationState = "ok";

		if (options) {
			for (const k in options) {
				if (options.hasOwnProperty(k) && k !== "hooks")
					this[k] = options[k];
			}
		}

		this.hookAll(options.hooks);
		this.checkKey = mkChecker(this.checkKey, "check");
		this.checkWord = mkChecker(this.checkWord, "validate");

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
		if (value !== null) {
			if (typeof this.process == "function")
				this.value = this.process(value);
			else
				this.value = value;
		}

		this.initialized = true;
		this.form.changed = true;

		this[SELF_TRIGGER](this.value);
		this.form.propagateMap = {};
		
		this.form.callHooks("trigger", this, this.value);
		this.callHooks("sourceTrigger");
	}

	[SELF_TRIGGER](value) {
		if (typeof this.trigger == "function")
			this.trigger(value);

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
		this.callHooks("update");
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

export {
	UPDATE,
	CHECK,
	TRIGGER,
	SELF_TRIGGER
};