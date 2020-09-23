import splitPath from "./split-path";
import hasOwn from "./has-own";
import {
	composeOptionsTemplates,
	createOptionsObject
} from "./internal/options";

// Gets data from object. If the autoBuild flag is truthy, it will
// automatically add an object or array to extend the data
// structure. Otherwise it just returns undefined or the default value
// context returns the accessed object and the parent
const OPTIONS_TEMPLATES = composeOptionsTemplates({
	autoBuild: true,
	context: true,
	trace: true,
	info: true,
	traceContext: {
		trace: true,
		context: true,
	},
	own: true
});

export default function get(data, path, def, options = {}) {
	options = createOptionsObject(options, OPTIONS_TEMPLATES);

	const split = Array.isArray(path) ?
			path :
			splitPath(path),
		trace = [],
		nodeTrace = [],
		resolve = typeof options.resolve == "function" ?
			options.resolve :
			null,
		resolveKey = typeof options.resolveKey == "function" ?
			options.resolveKey :
			null;
	let d = data,
		parent = data,
		childKey = null,
		match = true,
		built = false,
		error = null;

	const useBundledOutput = options.context || options.trace || options.info;

	for (let i = options.pathOffset || 0, l = split.length; i < l; i++) {
		let key;

		if (resolveKey)
			key = resolveKey(split[i], i, split, d);
		else if (resolve) {
			const resolved = resolve(split[i], i, split, d);

			if (typeof resolved == "string")
				key = resolved;
			else if (Array.isArray(resolved)) {
				if (resolved.length > 1)
					([key, d] = resolved);
				else if (resolved.length == 1)
					key = resolved[0];
			} else if (resolved) {
				if (hasOwn(resolved, "key"))
					key = resolved.key;
				if (hasOwn(resolved, "data"))
					d = resolved.data;
			} else
				key = split[i];
		} else
			key = split[i];

		if (!d || key === undefined || ((d[key] === undefined || options.own) && !hasOwn(d, key))) {
			match = false;

			if (useBundledOutput) {
				if (!d)
					error = "no-data";
				else if (key === undefined)
					error = "no-key";
				else if (d[key] === undefined && !hasOwn(d, key))
					error = "no-value";
				else if (options.own && !hasOwn(d, key))
					error = "proto-access";
			}

			if (options.autoBuild) {
				d[key] = split[i + 1] != null && !isNaN(split[i + 1]) ? [] : {};
				built = true;
			} else {
				d = def;
				break;
			}
		}

		if (options.trace) {
			trace.push(key);
			nodeTrace.push(d);
		}

		parent = d;
		childKey = key;
		d = d[key];
	}

	if (useBundledOutput) {
		d = {
			data,
			match,
			built,
			error
		};
	}

	if (options.context) {
		d.context = parent;
		d.key = childKey;
	}

	if (options.trace) {
		d.trace = trace;
		d.nodeTrace = nodeTrace;
	}

	return d;
}
