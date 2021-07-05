const pugPlainLoader = require("pug-plain-loader");
const { untab } = require("../utils");

// This loader wraps pug-plain-loader and removes undesired indentation
// so that no parsing errors occur within the Vue parser

module.exports = function(...args) {
	args[0] = untab(args[0], null, true);
	return pugPlainLoader.apply(this, args);
};
