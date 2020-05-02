import { sym } from "./sym";
import { isObject } from "./is";
import repeat from "./repeat";
import hasOwn from "./has-own";
import {
	uncirculate,
	isCircular,
	circularIdKey,
	circularRefKey,
	circularIsKey
} from "./obj";

const WRAPPED_SYM = sym("serialize wrapper");

export default function serialize(data, optionsOrIndentStr = {}) {
	let options = optionsOrIndentStr;

	if (typeof optionsOrIndentStr == "string") {
		options = {
			indentStr: optionsOrIndentStr
		};
	}

	const indentStr = typeof options.indentStr == "string" ? options.indentStr : "\t",
		startIndent = typeof options.indent == "number" ? options.indent || 0 : 0,
		quoteChar = typeof options.quote == "string" && !options.jsonCompatible ? options.quote : "\"",
		bareString = options.bareString && !options.jsonCompatible,
		optionalReplacer = typeof options.replace == "function" ? options.replace : null,
		replace = (key, item, wrap) => {
			if (key == circularIdKey)
				return;

			if (optionalReplacer)
				item = optionalReplacer(key, item, wrap);

			if (isObject(item)) {
				if (hasOwn(item, circularRefKey))
					return wrap("raw", "[circular]");

				if (hasOwn(item, circularIsKey))
					return item.data;
			}

			return item;
		};

	const srz = (key, item, indent = 0, preventReplace = false, preventBareString = false) => {
		if (replace && !preventReplace)
			item = replace(key, item, wrapItem, indent);

		if (isObject(item) && hasOwn(item, WRAPPED_SYM)) {
			switch (item[WRAPPED_SYM]) {
				case "raw":
					return typeof item.data == "string" ?
						item.data :
						srz(key, item.data, indent, true);
			}
		} else switch (typeof item) {
			// TODO: escape " characters in strings
			case "string":
				return bareString && !preventBareString ? item : `"${item}"`;

			case "number":
				return isNaN(item) || !isFinite(item) ? "null": String(item);

			case "boolean":
				return String(item);
				
			case "object":
				if (item == null)
					return "null";
				
				if (Array.isArray(item)) {
					const out = [],
						indentSeq = repeat(indentStr, indent + 1);
					let flat = true;

					for (let i = 0, l = item.length; i < l; i++) {
						const serialized = srz(i, item[i], indent + 1);

						if (serialized !== undefined)
							out.push(serialized);

						if (isObject(item[i]))
							flat = false;
					}

					return flat ?
						`[${out.join(", ")}]` :
						`[\n${indentSeq}${out.join(`,\n${indentSeq}`)}\n${repeat(indentStr, indent)}]`;
				}
				
				if (isObject(item) || !options.jsonCompatible) {
					const out = [];

					for (const k in item) {
						const serialized = srz(k, item[k], indent + 1, preventReplace, true);

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

				if (options.resolveFunctions) {
					return srz(
						null,
						item(Object.assign({
							data,
							key,
							item,
							indent
						}, options.args)),
						indent
					);
				}
				
				return item.toString()
					.split(/\n|\r/)
					.join(`\n${repeat(indentStr, indent)}`);

			case "symbol":
				if (options.jsonCompatible)
					return "{}";

				return `Symbol(${Symbol.keyFor(item) || ""})`;
		}
	};

	// First try stringifying the data as-is. If that fails,
	// try again but uncirculate the data before use
	try {
		if (options.isCircular && !isCircular(data))
			return repeat(indentStr, startIndent) + srz(null, uncirculate(data), startIndent);

		return repeat(indentStr, startIndent) + srz(null, data, startIndent);
	} catch (e) {
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Cyclic_object_value
		if (e instanceof RangeError || (e instanceof TypeError && /circular|cyclic/i.test(e.message))) {
			console.warn("Found circular structure in input data; trying again. If you see this message frequently, consider explicitly enabling circular input support with the isCircular flag", data);
			return repeat(indentStr, startIndent) + srz(null, uncirculate(data));
		}

		throw e;
	}
}

function wrapItem(type, data) {
	if (typeof type != "string")
		throw new TypeError("Cannot wrap: provided type is not a string");

	return {
		[WRAPPED_SYM]: type,
		data
	};
}
