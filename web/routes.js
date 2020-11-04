const {
	exists,
	join
} = require("../pkg/node-utils");

// Views
const renderPkgPage = require("./views/pkg");
const renderErrorPage = require("./views/error");

function body(req) {
	return new Promise(resolve => {
		const buf = [];

		req
			.on("data", chunk => buf.push(chunk))
			.on("end", _ => {
				const bod = Buffer.concat(buf).toString();

				try {
					resolve(JSON.parse(bod));
				} catch {
					resolve(bod);
				}
			})
			.on("error", _ => resolve(null));
	});
}

module.exports = function routes(app) {
	app.get("/:page?", async (req, res) => {
		const pageName = req.params.page;

		if (pageName && await exists(join("pkg", pageName)))
			renderPkgPage(req, res, pageName);
		else
			renderErrorPage(req, res, pageName, `Failed to find package at ${req.url}`);
	});

	app.post("/test/post", async (req, res) => {
		const data = await body(req);

		res.send({
			success: true,
			message: "posted test data",
			data
		});
	});
};
