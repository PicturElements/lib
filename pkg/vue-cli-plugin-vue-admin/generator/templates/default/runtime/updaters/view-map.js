const path = require("path");
const {
	writeFile,
	stripExtension,
	traverseFileTree
} = require("@qtxr/node-utils");

const invalidIdentifierCharRegex = /^\d|[^\w$]/g;

const prefix =
`// This is an automatically generated file.
// Do not edit as changes won't persist on rebuild.

`;

const suffix =
`
};

export default viewMap;
`;

module.exports = async function genViewMap() {
	const imports = [],
		map = [];

	await traverseFileTree({
		cwd: path.join(__dirname, "../../models"),
		path: ""
	}, node => {
		if (node.type == "directory")
			return;

		const camelized = toDirCamelCase(node.path),
			pth = stripExtension(node.path),
			quoted = quoteFileName(node.fileName);

		imports.push(`import ${camelized} from "../../models/${pth}";`);
		map.push(`\t${quoted}: {
\t\tview: _ => import("../../views/${pth}.vue"),
\t\tmodel: ${camelized}
\t}`);
	});

	await writeFile(
		path.join(__dirname, "../gen/view-map.js"),
		prefix + imports.join("\n") + "\n\nconst viewMap = {\n" + map.join(",\n") + suffix
	);
};

function toDirCamelCase(pth) {
	return stripExtension(pth).split(/[\\/]/).map(comp => {
		return comp.replace(/[_-]+(.)/g, (match, capture) => {
			return capture.toUpperCase();
		}).replace(invalidIdentifierCharRegex, "_");
	}).join("_");
}

function quoteFileName(file) {
	file = stripExtension(file);
	return invalidIdentifierCharRegex.test(file) ? `"${file}"` : file;
}
