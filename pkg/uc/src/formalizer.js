import { matchType } from "@qtxr/utils";

const FIELD_SPECIES = {
	if: "directive",
	else: "directive",
	to: "transform",
	from: "transform",
	validate: "validator",
	validateTo: "validator",
	validateFrom: "validator"
};

export default class Formalizer {
	constructor() {
		this.directives = [];
		this.activeDirective = null;
		this.tracking = {
			ifs: 0,
			directiveType: null,
			lastField: null,
			addedTo: false,
			addedElse: false,
			addedFrom: false,
			addedToValidator: false,
			addedFromValidator: false,
			addedAllToValidator: false,
			addedAllFromValidator: false,
			addedAllValidator: false
		};
	}

	if(condition) {
		logOrder("if", this.tracking);

		this.activeDirective = mkDirective({
			type: "if",
			condition
		});
		this.directives.push(this.activeDirective);
		return this;
	}

	get else() {
		logOrder("else", this.tracking);

		this.activeDirective = mkDirective({
			type: "else"
		});
		this.directives.push(this.activeDirective);
		return this;
	}

	to(transform) {
		logOrder("to", this.tracking);
		if (typeof transform != "function")
			throw new TypeError("Cannot define transform: transformer is not a function");

		this.activeDirective.toTransform = transform;
		return this;
	}

	from(transform) {
		logOrder("from", this.tracking);
		if (typeof transform != "function")
			throw new TypeError("Cannot define transform: transformer is not a function");

		this.activeDirective.fromTransform = transform;
		return this;
	}

	validate(validator) {
		logOrder("validate", this.tracking);
		this.activeDirective.validator = validator;
		return this;
	}

	validateTo(validator) {
		logOrder("validateTo", this.tracking);

		for (let i = 0, l = this.directives.length; i < l; i++)
			this.directives[i].globalToValidator = validator;

		return this;
	}

	validateFrom(validator) {
		logOrder("validateFrom", this.tracking);

		for (let i = 0, l = this.directives.length; i < l; i++)
			this.directives[i].globalFromValidator = validator;

		return this;
	}

	transform(data) {
		let formalizer;

		for (let i = 0, l = this.directives.length; i < l; i++) {
			const directive = this.directives[i];

			if (matches(data, directive)) {
				formalizer = new FormalizerCell(data, directive, this);
				break;
			}
		}

		if (!formalizer)
			formalizer = new FormalizerCell(data, mkDirective(), this);

		formalizer.validate("globalToValidator", formalizer.data);
		return formalizer;
	}
}

class FormalizerCell {
	constructor(data, directive, owner) {
		this.sourceData = data;
		this.data = directive.toTransform(data);
		this.sourceDirective = directive;
		this.owner = owner;
		this.validate("toValidator", this.data);
	}

	transform() {
		const data = this.sourceDirective.fromTransform(this.data, this);
		this.validate("fromValidator", data);
		this.validate("globalFromValidator", data);
		return data;
	}

	validate(type, data) {
		const validator = this.sourceDirective[type];

		if (validator == null)
			return true;

		if (!matchesValidation(data, validator, this))
			throw new Error(`Validation failed (${type})`);

		return true;
	}
}

function matches(data, directive) {
	if (!matchType(directive.condition, "string|object|function"))
		return Boolean(directive.condition);

	if (directive.type == "else")
		return true;

	return matchType(data, directive.condition);
}

function matchesValidation(data, validator, formalizer) {
	if (!matchType(validator, "string|object|function"))
		return Boolean(validator);

	if (typeof validator == "function")
		return validator(data, formalizer);

	return matchType(data, validator);
}

function logOrder(type, tracking) {
	const species = FIELD_SPECIES[type];
	
	const err = msg => {
		throw new Error(`Cannot define '${type}' ${species}: ${msg}`);
	};

	const lastField = tracking.lastField,
		isGlobalValidator = type == "validateTo" || type == "validateFrom",
		missingTransforms = !tracking.addedTo || !tracking.addedFrom;

	if (tracking.addedAllValidator && !isGlobalValidator)
		err(`cannot add ${species} after global validators`);

	if (type == "else" && tracking.addedElse)
		err("cannot add multiple else directives");

	if (tracking.ifs && type != "validate" && !isGlobalValidator && species != "transform" && missingTransforms)
		err("if/else directive must contain a 'to' and 'from' transformer");

	switch (type) {
		case "if":
			if (tracking.addedElse)
				err("if may not come after else directive");

			tracking.directiveType = "if";
			tracking.ifs++;
			tracking.addedTo = false;
			tracking.addedFrom = false;
			break;

		case "else":
			if (!tracking.ifs)
				err("if must come before this directive");

			tracking.directiveType = "else";
			tracking.addedElse = true;
			tracking.addedTo = false;
			tracking.addedFrom = false;
			break;

		case "to":
			if (!tracking.ifs)
				err("if or else must come before this directive");
			if (tracking.addedTo)
				err(`already defined transformer in ${tracking.directiveType} directive`);

			tracking.addedTo = true;
			break;

		case "from":
			if (!tracking.ifs)
				err("if or else must come before this directive");
			if (tracking.addedFrom)
				err(`already defined transformer in ${tracking.directiveType} directive`);

			tracking.addedFrom = true;
			break;

		case "validate":
			if (!tracking.ifs)
				err("if or else must come before this directive");
			if (FIELD_SPECIES[lastField] != "transform")
				err("failed to find a transformer to which to attach a validor");

			if (lastField == "to" && !tracking.addedToValidator)
				tracking.addedToValidator = true;
			else if (lastField == "from" && !tracking.addedFromValidator)
				tracking.addedFromValidator = true;
			else
				err(`already defined a validator for '${lastField}' transformer`);
			break;

		case "validateTo":
			if (!tracking.ifs)
				err("at least one if or else must come before this validator");
			if (tracking.addedAllToValidator)
				err("a global 'to' validator has already been defined");

			tracking.addedAllValidator = true;
			tracking.addedAllToValidator = true;
			break;

		case "validateFrom":
			if (!tracking.ifs)
				err("at least one if or else must come before this validator");
			if (tracking.addedAllFromValidator)
				err("a global 'from' validator has already been defined");

			tracking.addedAllValidator = true;
			tracking.addedAllFromValidator = true;
			break;
	}

	tracking.lastField = type;
}

function mkDirective(data) {
	return Object.assign({
		type: null,
		condition: null,
		toTransform: d => d,
		toValidator: null,
		globalToValidator: null,
		fromTransform: d => d,
		fromValidator: null,
		globalFromValidator: null
	}, data);
}

export {
	FormalizerCell
};
