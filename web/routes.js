const {
	exists,
	join
} = require("../pkg/node-utils");

// Views
const renderPkgPage = require("./views/pkg");
const renderErrorPage = require("./views/error");

module.exports = function routes(app) {
	app.get("/:page?", async (req, res) => {
		const pageName = req.params.page;

		if (pageName && await exists(join("pkg", pageName)))
			renderPkgPage(req, res, pageName);
		else
			renderErrorPage(req, res, pageName, `Failed to find package at ${req.url}`);
	});
};
