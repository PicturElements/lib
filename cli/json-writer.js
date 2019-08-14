const Form = require("./form");
const {
	writeFile,
	isObject,
	repeat
} = require("./utils");

// JSON field structure:
// {
//		name		(string, required)		name of field
//		value		(any)					value of field, required if fields is not present
//		fields		(array[field])			value of field, required if value is not present
//		process		(function)				processing function for CLI input
//		precedence	(int, default: 10)		precendence (higher == more important) in CLI; if a field has a lower
//											precedence than the current CLI session, it will be ignored
//		question	(string / function)		description / description resolver to pose as a question in questionnaires
// }
//
// Unless specified, all functions will be passed the following parameters:
// input value, field, writer

module.exports = class JSONWriter extends Form {
	constructor(fields, config, runtime) {
		super(fields, config, runtime);
	}

	serialize(indentChar, custom) {
		return custom ? structuredSerialize(this.fields, indentChar, true) : JSON.stringify(this.extract(), null, indentChar);
	}

	async write(url, indentChar, custom) {
		return await writeFile(url, this.serialize(indentChar, custom));
	}
};

function structuredSerialize(fieldsOrItem, indentChar = "\t", isFieldArray = false) {
	const serialize = (item, indent = 0) => {
		switch (typeof item) {
			case "string":
				return `"${item}"`;
			case "number":
				return isNaN(item) || !isFinite(item) ? "null": String(item);
			// case "bigint": JSON.stringify does not yet support BigInt serialization
			case "boolean":
				return String(item);
			case "object":
				if (item == null)
					return "null";
				
				if (Array.isArray(item)) {
					const flat = !item.some(isObject);
					if (flat)
						return `[${item.map(serialize).join(", ")}]`;

					const out = [];

					for (const elem of item) {
						const serialized = serialize(elem, indent + 1);

						if (serialized !== undefined)
							out.push(repeat(indentChar, indent + 1) + serialized);
					}

					return `[\n${out.join(",\n")}\n${repeat(indentChar, indent)}]`;
				}
				
				if (isObject(item)) {
					const out = [];

					for (const k in item) {
						const serialized = serialize(item[k], indent + 1);

						if (serialized !== undefined)
							out.push(`${repeat(indentChar, indent + 1)}"${k}": ${serialized}`);
					}

					if (!out.length)
						return "{}";

					return `{\n${out.join(",\n")}\n${repeat(indentChar, indent)}}`;
				}

				return "{}";
			case "function":
				return "{}";
		}
	};

	const serializeFields = (fields, indent) => {
		const out = [];

		for (const field of fields) {
			if (field.hasOwnProperty("fields"))
				out.push(serialize(field.fiels, indent + 1));
			else {
				const serialized = serialize(field.value, indent + 1);
				if (serialized !== undefined)
					out.push(`${repeat(indentChar, indent + 1)}"${field.name}": ${serialized}\n`);
			}
		}

		if (!out.length)
			return "{}";

		return `{\n${out.join(",\n")}\n${repeat(indentChar, indent)}}`;
	};

	if (isFieldArray)
		return serializeFields(fieldsOrItem, 0);

	return serialize(fieldsOrItem, 0);
}
