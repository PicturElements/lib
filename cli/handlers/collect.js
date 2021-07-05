const path = require("path");
const { error } = require("../../pkg/node-utils");

module.exports = function collect(options) {
	if (!options.args.length)
		return error("Failed to collect: no collector defined");

	try {
		const collector = require(
			path.join(__dirname, "../collectors", options.args[0])
		);

		if (typeof collector != "function")
			return error(`Failed to collect: '${options.args[0]}' is not a valid collector`);

		return collector(options);
	} catch {
		return error(`Failed to collect: '${options.args[0]}' is not a known collector`);
	}
};
