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

	const split = Array.isArray(path) ? path : splitPath(path),
		trace = [],
		nodeTrace = [],
		resolveKey = typeof options.resolveKey == "function" ?
			options.resolveKey :
			null;
	let parent = data,
		childKey = null,
		match = true,
		built = false,
		error = null;

	const useBundledOutput = options.context || options.trace || options.info;

	for (let i = options.pathOffset || 0, l = split.length; i < l; i++) {
		const key = resolveKey ?
			resolveKey(split[i], i, split, data) :
			split[i];

		if (!data || key === undefined || ((data[key] === undefined || options.own) && !hasOwn(data, key))) {
			match = false;

			if (useBundledOutput) {
				if (!data)
					error = "no-data";
				else if (key === undefined)
					error = "no-key";
				else if (data[key] === undefined && !hasOwn(data, key))
					error = "no-value";
				else if (options.own && !hasOwn(data, key))
					error = "proto-access";
			}

			if (options.autoBuild) {
				data[key] = split[i + 1] != null && !isNaN(split[i + 1]) ? [] : {};
				built = true;
			} else {
				data = def;
				break;
			}
		}

		if (options.trace) {
			trace.push(key);
			nodeTrace.push(data);
		}

		parent = data;
		childKey = key;
		data = data[key];
	}

	if (useBundledOutput) {
		data = {
			data,
			match,
			built,
			error
		};
	}

	if (options.context) {
		data.context = parent;
		data.key = childKey;
	}

	if (options.trace) {
		data.trace = trace;
		data.nodeTrace = nodeTrace;
	}

	return data;
}
