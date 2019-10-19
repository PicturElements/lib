const pug = require("pug");
const { join } = require("../../pkg/node-utils");

module.exports = async function renderErrorPage(req, res, pageName, errorMsg) {
	const docPath = join(__dirname, "../../web/defaults/templates/error.pug");

	const compiled = pug.compileFile(docPath, {
			self: true
		}),
		locals = {
			title: `Error at ${pageName}`,
			errorMsg
		};

	res.send(compiled(locals));
};
