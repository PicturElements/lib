import { isObject } from "./is";
import { repeat } from "./str";

export default function serialize(fieldsOrItem, optionsOrIndentStr = {}) {
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
		switch (typeof item) {
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
							out.push(repeat(indentStr, indent + 1) + serialized);
					}

					return `[\n${out.join(",\n")}\n${repeat(indentStr, indent)}]`;
				}
				
				if (isObject(item)) {
					const out = [];

					for (const k in item) {
						const serialized = srz(item[k], indent + 1);

						if (serialized !== undefined)
							out.push(`${repeat(indentStr, indent + 1)}${quoteChar}${k}${quoteChar}: ${serialized}`);
					}

					if (!out.length)
						return "{}";

					return `{\n${out.join(",\n")}\n${repeat(indentStr, indent)}}`;
				}

				return "{}";
				
			case "function":
				if (options.jsonCompatible)
					return "{}";
				
				return item.toString().split(/\n|\r/).join(`\n${repeat(indentStr, indent)}`);
		}
	};

	return repeat(indentStr, startIndent) + srz(fieldsOrItem, startIndent);
}
