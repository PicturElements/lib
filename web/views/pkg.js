const pug = require("pug");
const {
	join,
	findUrl,
	readJSON,
	joinDir
} = require("../../cli/utils");
const { resolveLocals } = require("../expose");

module.exports = async function renderPkgPage(req, res, pageName) {
	const root = joinDir("pkg", pageName);
	const docPath = await findUrl(join(root, "index.pug"), joinDir("web/defaults/templates/index.pug"));
	const package = await readJSON(join(root, "package.json"));

	const compiled = pug.compileFile(docPath, {
		self: true
	});
	const locals = await resolveLocals(pageName, package);

	res.send(compiled(locals));
};
