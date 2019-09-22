const NestedReadlineInterface = require("./nested-readline-interface");
const {
	ask,
	calcPrecedence,
	calcPrecedenceFromCLIOptions
} = require("./utils");
const {
	resolveVal,
	shortPrint,
	coerceNum,
	isObject
} = require("../utils");

const FIELDMAP_SRC_SYMBOL = Symbol("fieldMap source"),
	DEF_PRECEDENCE = 10,
	DEF_RL_INTERFACE_SETTINGS = {
		input: process.stdin,
		output: process.stdout
	},
	FORM_INTERFACE_PARTITION_NAME = Symbol("Form readline partition"),
	PRECEDENCE_NAMES = {
		v: 0,
		verbose: 0,
		d: 5,
		detailed: 5,
		t: 10,
		terse: 10
	};

// Important: this class follows the same function parameter rules
// as JSONForm. Check ./json-form.js for more details

module.exports = class Form {
	constructor(fields, config, runtime) {
		fields = Array.isArray(fields) ? fields : [fields];
		this.fields = fields;
		this.fieldMap = this._calcFieldMap(fields);
		this.config = config || {};
		this.runtime = runtime || {};
	}

	_calcFieldMap(fields) {
		const map = {
			[FIELDMAP_SRC_SYMBOL]: fields
		};

		for (const field of fields) {
			if (field.hasOwnProperty("fields"))
				map[field.name] = this._calcFieldMap(field.fields);
			else
				map[field.name] = field;
		}

		return map;
	}

	extract() {
		return Form.extract(this.fields);
	}

	// TODO: use getItem or similar to handle nested fields
	set(key, value, map = this.fieldMap) {
		const partition = map[key];

		if (!partition)
			return;

		if (partition.hasOwnProperty("fields")) {
			if (!isObject(value))
				return console.warn("Cannot set value on fielded field: value must be a field object");

			for (const k in value)
				this.set(k, value[k], map[k]);
		} else
			partition.value = value;
	}

	get(keyOrField, map = this.fieldMap) {
		let partition = null;

		if (typeof keyOrField == "string") {
			const path = keyOrField.split(".");

			partition = path.reduce((part, key) => {
				return part && (part[key] || null);
			}, map);
		} else 
			partition = keyOrField;

		if (!partition)
			return null;

		if (partition.hasOwnProperty("fields"))
			return this.extract(partition.fields);

		return partition.value;
	}

	async cli(precedence = DEF_PRECEDENCE, rlSettings = DEF_RL_INTERFACE_SETTINGS) {
		const rl = NestedReadlineInterface.create(FORM_INTERFACE_PARTITION_NAME, rlSettings);
		
		const runCLI = async (fields, map) => {
			for (const field of fields) {
				const prec = coerceNum(field.precedence, DEF_PRECEDENCE);

				if (prec < precedence)
					continue;

				if (field.hasOwnProperty("fields")) {
					await runCLI(field.fields, map[field.name]);
					continue;
				}

				let question = resolveVal(field.question, field, this),
					questionVal = null;
				question = question || mkQuestion(this, field);

				while (true) {
					questionVal = await ask(rl, `${question} `);

					if (!questionVal)
						break;

					const validation = typeof field.validate == "function" ? field.validate(questionVal) : true;

					if (validation !== true)
						console.log(mkErrorMsg(this, field, validation));
					else
						break;
				}

				if (!questionVal)
					continue;

				if (typeof field.process == "function")
					questionVal = field.process(questionVal, field, this);

				this.set(
					field.name,
					questionVal,
					map
				);
			}
		};

		await runCLI(this.fields, this.fieldMap);
		rl.close();
		return true;
	}

	static extract(fields) {
		const out = {};

		for (const field of fields) {
			if (field.hasOwnProperty("fields"))
				out[field.name] = this.extract(field.fields);
			else
				out[field.name] = field.value;
		}

		return out;
	}

	static calcPrecedence(inp) {
		return calcPrecedence(inp, PRECEDENCE_NAMES, DEF_PRECEDENCE);
	}

	static calcPrecedenceFromCLIOptions(options) {
		return calcPrecedenceFromCLIOptions(options, PRECEDENCE_NAMES, DEF_PRECEDENCE);
	}
};

function mkQuestion(form, field) {
	switch (form.config.questionType) {
		case "terse":
			return `${field.name} (${shortPrint(form.get(field))}):`;
		default:
			return `Set value for '${field.name}' (${shortPrint(form.get(field))}):`;
	}
}

function mkErrorMsg(form, field, validatorResponse) {	
	if (typeof validatorResponse == "string")
		return validatorResponse;
	
	return mkDefaultErrorMsg(form, field);
}

function mkDefaultErrorMsg(form, field) {
	switch (form.config.questionType) {
		default:
			return `Incorrect value for ${field.name}`;
	}
}
