const path = require("path");

module.exports = async function i18n(options, cmd) {
	switch (cmd) {
		case "mkmap":
			console.log("generating sitemap...");
			break;
		default:
			console.log(`Invalid command '${cmd || ""}'`);
	}
};
