const pug = require("pug");
const {
	join,
	findPath,
	readJSON
} = require("../../pkg/node-utils");
const { resolveLocals } = require("../expose");

module.exports = async function renderPkgPage(req, res, pageName) {
	const root = join(__dirname, "../../pkg", pageName);
	const docPath = await findPath(join(root, "index.pug"), join(__dirname, "../../web/defaults/templates/index.pug"));
	const package = await readJSON(join(root, "package.json"));

	const compiled = pug.compileFile(docPath, {
		self: true
	});
	const locals = await resolveLocals(pageName, package);

	res.send(compiled(locals));
};
