const pug = require("pug");
const { joinDir } = require("../../cli/utils");

module.exports = async function renderPkgPage(req, res, pageName, errorMsg) {
	const docPath = joinDir("web/defaults/error.pug");

	const compiled = pug.compileFile(docPath, {
			self: true
		}),
		locals = {
			title: `Error at ${pageName}`,
			errorMsg
		};

	res.send(compiled(locals));
};
