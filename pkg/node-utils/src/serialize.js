const { isObject } = require("./utils");
const { warn } = require("./io/console");

const specialTokenSym = Symbol("specialToken");

function serialize(fieldsOrItem, optionsOrIndentStr = {}) {
	let options = optionsOrIndentStr;

	if (typeof optionsOrIndentStr == "string") {
		options = {
			indentStr: optionsOrIndentStr
		};
	}

	const indentStr = typeof options.indentStr == "string" ? options.indentStr : "\t",
		startIndent = typeof options.indent == "number" ? options.indent || 0 : 0,
		quoteChar = typeof options.quote == "string" && !options.jsonCompatible ? options.quote : "\"";

	const srz = (item, indent = 0) => {
		switch (getSpecialTokenType(item) || typeof item) {
			// Token types
			case "raw":
			case "rawReplaceKey":
				return item.value;

			// Types
			case "string":
				return `"${item}"`;

			case "number":
				return isNaN(item) || !isFinite(item) ? "null": String(item);

			case "boolean":
				return String(item);

			case "object":
				if (item == null)
					return "null";

				if (Array.isArray(item)) {
					const flat = !item.some(isObject);
					if (flat)
						return `[${item.map(srz).join(", ")}]`;

					const out = [];

					for (const elem of item) {
						const serialized = srz(elem, indent + 1);

						if (serialized !== undefined)
							out.push(indentStr.repeat(indent + 1) + serialized);
					}

					return `[\n${out.join(",\n")}\n${indentStr.repeat(indent)}]`;
				}

				if (isObject(item)) {
					const out = [];

					for (const k in item) {
						const serialized = srz(item[k], indent + 1);

						if (serialized !== undefined) {
							if (getSpecialTokenType(item[k]) == "rawReplaceKey")
								out.push(`${indentStr.repeat(indent + 1)}${item[k].value}`);
							else
								out.push(`${indentStr.repeat(indent + 1)}${quoteChar}${k}${quoteChar}: ${serialized}`);
						}
					}

					if (!out.length)
						return "{}";

					return `{\n${out.join(",\n")}\n${indentStr.repeat(indent)}}`;
				}

				return "{}";

			case "function":
				if (options.jsonCompatible)
					return "{}";

				return item.toString().split(/\n|\r/).join(`\n${indentStr.repeat(indent)}`);
		}
	};

	return indentStr.repeat(startIndent) + srz(fieldsOrItem, startIndent);
}

serialize.raw = value => {
	if (typeof value != "string") {
		warn("Failed to add raw value: provided value is not a string");
		return null;
	}

	return {
		value,
		[specialTokenSym]: "raw"
	};
};

serialize.rawReplaceKey = value => {
	if (typeof value != "string") {
		warn("Failed to add raw value: provided value is not a string");
		return null;
	}

	return {
		value,
		[specialTokenSym]: "rawReplaceKey"
	};
};

function getSpecialTokenType(item) {
	if (!item || !item.hasOwnProperty(specialTokenSym))
		return null;

	return item[specialTokenSym];
}

module.exports = serialize;
