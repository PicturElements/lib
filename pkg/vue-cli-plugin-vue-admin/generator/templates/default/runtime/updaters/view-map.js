const path = require("path");
const {
	readdir,
	writeFile,
	stripExtension
} = require("@qtxr/node-utils");

const invalidIdentifierCharRegex = /^\d|[^\w$]/g;

const prefix =
`// This is an automatically generated file. Do not
// edit as changes won't be preserved on rebuild

`;

const suffix =
`
};

export default viewMap;
`;

module.exports = async function genViewMap() {
	const files = await readdir(path.join(__dirname, "../../models"));
	const imports = [],
		map = [];

	for (const file of files) {
		const stripped = stripExtension(file),
			normalized = normalizeFileName(file),
			quoted = quoteFileName(file);

		imports.push(`import ${normalizeFileName(file)} from "../../models/${stripped}";`);
		map.push(`\t${quoted}: {
\t\tview: _ => import("../../views/${stripped}.vue"),
\t\tmodel: ${normalized}
\t}`);
	}

	const content = prefix + imports.join("\n") + "\n\nconst viewMap = {\n" + map.join(",\n") + suffix;
	await writeFile(
		path.join(__dirname, "../gen/view-map.js"),
		content
	);
};

function normalizeFileName(file) {
	return stripExtension(file).replace(/-(.)/g, (match, capture) => {
		return capture.toUpperCase();
	}).replace(invalidIdentifierCharRegex, "_");
}

function quoteFileName(file) {
	file = stripExtension(file);
	return invalidIdentifierCharRegex.test(file) ? `"${file}"` : file;
}
