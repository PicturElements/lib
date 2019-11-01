const path = require("path");
const {
	warn,
	readdir,
	writeFile,
	stripExtension
} = require("@qtxr/node-utils");

const invalidIdentifierCharRegex = /^\d|[^\w$]/g;

const prefix =
`// This is an automatically generated file.
// Do not edit as changes won't persist on rebuild.

// Stock components from VueAdmin
import * as vueAdminComponents from "@qtxr/vue-admin/components";

// Local components
`;

const suffix =
`
};

export default components;
`;

module.exports = async function genComponentExport() {
	const files = await readdir(path.join(__dirname, "../../components"));
	const imports = [],
		map = [];

	for (const file of files) {
		if (!file.endsWith(".vue"))
			continue;

		const pascalized = toPascalCase(file);

		if (invalidIdentifierCharRegex.test(pascalized)) {
			warn(`Refusing to import '${file}' as its corresponding PascalCased identifier (${pascalized}) is invalid. Consider renaming the file`);
			continue;
		}

		imports.push(`import ${pascalized} from "./${file}";`);
		map.push(pascalized);
	}

	await writeFile(
		path.join(__dirname, "../../components/index.js"),
		prefix + imports.join("\n") + `
		
const components = {
	...vueAdminComponents,
	${map.join(",\n\t")}` + suffix
	);
};

function toPascalCase(file) {
	return stripExtension(file)
		.split(/-/)
		.map(s => s[0].toUpperCase() + s.substr(1))
		.join("");
}
