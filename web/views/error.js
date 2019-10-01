const pug = require("pug");
const { joinDir } = require("../../cli/utils");

module.exports = async function renderErrorPage(req, res, pageName, errorMsg) {
	const docPath = joinDir("web/defaults/templates/error.pug");

	const compiled = pug.compileFile(docPath, {
			self: true
		}),
		locals = {
			title: `Error at ${pageName}`,
			errorMsg
		};

	res.send(compiled(locals));
};
