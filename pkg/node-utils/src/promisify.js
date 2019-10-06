const { isObject } = require("./utils");

module.exports = function promisify(func, paramNamesOrParamMap, returnKeyOrReturnIndex, optionsOrCallback) {
	const callback = typeof optionsOrCallback == "function" ?
			optionsOrCallback :
			(optionsOrCallback && optionsOrCallback.callback) || null,
		options = optionsOrCallback && typeof optionsOrCallback == "object" ?
			optionsOrCallback :
			{};

	const handler = (resolve, args) => {
		if (typeof callback == "function")
			callback(resolve, ...args);
		else if (isObject(paramNamesOrParamMap)) {				// Parameter name/index map
			if (args[paramNamesOrParamMap.err])
				return resolve(null);

			const retIndex = typeof returnKeyOrReturnIndex == "string" ?
				paramNamesOrParamMap[returnKeyOrReturnIndex] :
				returnKeyOrReturnIndex;

			resolve(args[retIndex]);
		} else if (Array.isArray(paramNamesOrParamMap)) {		// Parameter name list
			const namedArgs = nameArgs(args, paramNamesOrParamMap);

			if (namedArgs.err)
				return resolve(null);
			
			resolve(namedArgs[returnKeyOrReturnIndex]);
		} else
			resolve(args[returnKeyOrReturnIndex || 0]);
	};

	return args => {
		return new Promise(resolve => {
			switch (options.mode) {
				case "manual":
					if (typeof callback == "function")
						callback(resolve, func(...args));
					break;

				case "manual-manual-call":
					if (typeof callback == "function")
						callback(resolve, func, ...args);
					break;

				default:
					func(...args, (...a) => handler(resolve, a));
			}
		});
	};
};

function nameArgs(args, argNames) {
	const len = Math.min(args.length, argNames),
		out = {};

	for (let i = 0; i < len; i++)
		out[argNames[i]] = args[i];

	return out;
}
