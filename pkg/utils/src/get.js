import splitPath from "./split-path";
import hasOwn from "./has-own";
import {
	composeOptionsTemplates,
	createOptionsObject
} from "./options";

// Gets data from object. If the autoBuild flag is truthy, it will
// automatically add an object or array to extend the data
// structure. Otherwise it just returns undefined or the default value
// context returns the accessed object and the parent

export default function get(data, path, def, options = {}) {
	options = createOptionsObject(options, optionsTemplates);
	
	const split = Array.isArray(path) ? path : splitPath(path),
		trace = [],
		nodeTrace = [],
		resolveKey = typeof options.resolveKey == "function" ?
			options.resolveKey :
			null;
	let parent = data,
		childKey = null,
		match = true,
		built = false;

	for (let i = options.pathOffset || 0, l = split.length; i < l; i++) {
		const key = resolveKey ?
			resolveKey(split[i], i, split) :
			split[i];

		if (!data || key === undefined || (data[key] === undefined && !hasOwn(data, key, true))) {
			match = false;

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

	const bundledOutput = options.context || options.trace;
	if (bundledOutput) {
		data = {
			data,
			match,
			built
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

const optionsTemplates = composeOptionsTemplates({
	autoBuild: true,
	context: true,
	trace: true,
	traceContext: {
		trace: true,
		context: true,
	}
});
