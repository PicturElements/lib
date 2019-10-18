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
	
	let split = Array.isArray(path) ? path : splitPath(path),
		trace = [],
		nodeTrace = [],
		parent = data,
		child = null,
		match = true,
		built = false;

	for (let i = options.pathOffset || 0, l = split.length; i < l; i++) {
		const prop = split[i];

		if (!data || prop === undefined || (data[prop] === undefined && !hasOwn(data, prop, true))) {
			match = false;

			if (options.autoBuild) {
				data[prop] = split[i + 1] != null && !isNaN(split[i + 1]) ? [] : {};
				built = true;
			} else {
				data = def;
				break;
			}
		}

		if (options.trace) {
			trace.push(prop);
			nodeTrace.push(data);
		}

		parent = data;
		child = prop;
		data = data[prop];
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
		data.key = child;
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
