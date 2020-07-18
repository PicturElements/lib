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

export default function serialize(data, optionsOrIndentStr = {}, args = null) {
	let options = optionsOrIndentStr;

	if (typeof optionsOrIndentStr == "string") {
		options = {
			indentStr: optionsOrIndentStr
		};
	}

	const indentStr = setStr(options.indentStr, "\t"),
		startIndent = typeof options.indent == "number" ? options.indent || 0 : 0,
		quoteChar = typeof options.quote == "string" && !options.jsonCompatible ? options.quote : "\"",
		bareString = options.bareString && !options.jsonCompatible,
		optionalReplacer = typeof options.replace == "function" ? options.replace : null,
		compact = Boolean(options.compact),
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

	let fieldSpacing = " ",
		arrSpacing = " ",
		objSpacing = " ",
		arrBoundarySpacing = "",
		objBoundarySpacing = " ";

	if (typeof options.spacing == "string")
		fieldSpacing = arrSpacing = objSpacing = arrBoundarySpacing = objBoundarySpacing = options.spacing;
	else if (isObject(options.spacing)) {
		if (typeof options.spacing.gap == "string")
			fieldSpacing = arrSpacing = objSpacing = options.spacing.gap;

		fieldSpacing = setStr(options.spacing.field, fieldSpacing);
		arrSpacing = setStr(options.spacing.arr, arrSpacing);
		objSpacing = setStr(options.spacing.obj, objSpacing);

		if (typeof options.spacing.boundary == "string")
			arrBoundarySpacing = objBoundarySpacing = options.spacing.boundary;

		arrBoundarySpacing = setStr(options.spacing.arrBoundary, arrBoundarySpacing);
		objBoundarySpacing = setStr(options.spacing.objBoundary, objBoundarySpacing);
	}

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

					if (flat || compact)
						return "[" + arrBoundarySpacing + out.join("," + arrSpacing) + arrBoundarySpacing + "]";

					return `[\n${indentSeq}${out.join(`,\n${indentSeq}`)}\n${repeat(indentStr, indent)}]`;
				}

				if (isObject(item) || !options.jsonCompatible) {
					const out = [],
						indt = compact ? "" : repeat(indentStr, indent + 1);

					for (const k in item) {
						const serialized = srz(k, item[k], indent + 1, preventReplace, true);

						if (serialized !== undefined)
							out.push(indt + quoteChar + k + quoteChar + ":" + fieldSpacing + serialized);
					}

					if (!out.length)
						return "{}";

					if (compact)
						return "{" + objBoundarySpacing + out.join("," + objSpacing) + objBoundarySpacing + "}";

					return `{\n${out.join(",\n")}\n${repeat(indentStr, indent)}}`;
				}

				return "{}";

			case "function":
				if (options.jsonCompatible)
					return "{}";

				if (options.resolveFunctions) {
					const ctx = {
							data,
							key,
							item,
							indent
						},
						a = args || options.args;
					let resolved;

					if (Array.isArray(a) && !options.singleContextArg)
						resolved = item(ctx, ...a);
					else {
						const arg = Array.isArray(a) ? a[0] : a;
						resolved = item(Object.assign(ctx, arg));
					}

					return srz(null, resolved, indent);
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

	if (options.isCircular && !isCircular(data))
		return repeat(indentStr, startIndent) + srz(null, uncirculate(data), startIndent);

	// First try stringifying the data as-is. If that fails,
	// try again but uncirculate the data before use
	try {
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

function setStr(candidate, def) {
	if (typeof candidate == "string")
		return candidate;

	return def;
}
