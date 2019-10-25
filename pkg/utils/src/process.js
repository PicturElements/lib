import { isObject } from "./is";

// Difference between hooks and processors
// Processors are similar to hooks, but behave like highly specialized
// and concrete middleware spliced in at certain points in applications
// Contrary to hooks, insofar as defined in @qtxr/bc/hookable,
// processors should never cause side effects. qtxr hooks are by
// definition side effects as they are implemented with the observer pattern
// where the Hookable subject notifies any number of observers without
// explicitly awaiting returned data. Processors are therefore different
// because as are pure functions that return a single value for use
// by the dependent software

// mkProcessor accepts two forms of input:
// 1. an object of processors
// 2. an object with:
//	  .processors object with processors (required)
//	  .transformers object with transformers  (optional)
//	   that can either transform existing processors to extend functionality,
//	   or create new processors from given data. These transforms are temporary
//	  .dispatch function (optional)
//	   that defines a custom dispatcher that runs processors. Dispatchers are
//	   given the following arguments:
//	   processor	- a resolved processor
//	   transformers	- the transformer object given to the built processor
//	   ...args		- arguments the prepend to the processor call. Good practice is that
//					  all processors receive these arguments no matter what they do

// The return processor must implement the following spec:
// 1. The processor function takes the following arguments:
//	  type			- the processor type (string, required)
//	  processors	- temporary override for any number of processors (object, optional)
//	  ...args		- arguments to prepend to the processor call. Good practice is that
//					  all processors receive these arguments no matter what they do
// 2. The returned value is where the processor is called, and where more arguments can
//	  be passed to them. These arguments are consequently appended to the argument list
//	  applied to the processor. Currying is used primarily to separate the base API from
//	  individual processor calls
// 3. Calling a nonexistent processor yields null, as do non-function processors
//	  that cannot be transformed to functions
// 4. Calling a processor without additional arguments should never fail on the high level

function mkProcessor(optionsOrProcessors) {
	if (!isObject(optionsOrProcessors))
		throw new TypeError("Failed to make processor: input is not an object");

	let processors = {},
		transformers = {},
		dispatcher = null;

	if (optionsOrProcessors.hasOwnProperty("processors")) {
		processors = setObj(optionsOrProcessors.processors, processors);
		transformers = setObj(optionsOrProcessors.transformers, transformers);
		dispatcher = optionsOrProcessors.dispatch;
	} else
		processors = optionsOrProcessors;

	return (type, proc, ...args) => {
		let processor = processors.hasOwnProperty(type) ? processors[type] : null;

		if (isObject(proc) && proc.hasOwnProperty(type))
			processor = proc[type];

		if (typeof dispatcher == "function")
			return dispatcher(processor, transformers, ...args);

		return (...curriedArgs) => {
			if (transformers.hasOwnProperty(type) && typeof transformers[type] == "function")
				processor = transformers[type](processor, type, ...args, ...curriedArgs);

			if (typeof processor == "function")
				return processor(...args, ...curriedArgs);

			return null;
		};
	};
}

function setObj(candidate, fallback) {
	if (isObject(candidate))
		return candidate;

	return fallback;
}

export {
	mkProcessor
};
