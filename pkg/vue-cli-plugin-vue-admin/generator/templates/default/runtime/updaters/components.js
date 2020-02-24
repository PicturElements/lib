const path = require("path");
const {
	warn,
	serialize,
	writeFile,
	stripExtension,
	traverseFileTree
} = require("@qtxr/node-utils");

const invalidIdentifierCharRegex = /^\d|[^\w$]/g;

const prefix =
`// This is an automatically generated file
// Do not edit as changes won't persist on rebuild

import { get } from "@qtxr/utils";

// Stock components from VueAdmin
import * as vueAdminComponents from "@qtxr/vue-admin/components";

// Local components
`;

const suffix =
`;

function injectComponents(comps, scopes = []) {
	const componentsInCurrentScope = [],
		scopesInCurrentScope = [];

	for (const k in comps) {
		if (!comps.hasOwnProperty(k))
			continue;

		if (isComponent(comps[k])) {
			componentsInCurrentScope.push({
				name: k,
				component: comps[k]
			});
		} else {
			scopesInCurrentScope.push({
				name: k,
				scope: comps[k]
			});
		}
	}

	scopes.push(componentsInCurrentScope);

	const cLen = componentsInCurrentScope.length,
		sLen = scopes.length;

	for (let i = 0; i < cLen; i++) {
		const targetComponent = componentsInCurrentScope[i].component,
			targetComponentName = componentsInCurrentScope[i].name;

		const outComps = {},
			tComps = targetComponent.components || {};

		for (let j = 0; j < sLen; j++) {
			const sc = scopes[j];

			for (let a = 0, l = sc.length; a < l; a++) {
				if (sc[a].name != targetComponentName)
					outComps[sc[a].name] = sc[a].component;
			}
		}

		for (const k in tComps) {
			if (!tComps.hasOwnProperty(k))
				continue;

			let comp = tComps[k];

			if (typeof tComps[k] == "string")
				comp = get(components, comp);

			if (!isComponent(comp))
				throw new Error(\`Failed to resolve component '\${k}' at '\${tComps[k]}' in \${targetComponentName}\`);
		
			outComps[k] = comp;
		}

		targetComponent.components = outComps;
	}

	for (let i = 0, l = scopesInCurrentScope.length; i < l; i++)
		injectComponents(scopesInCurrentScope[i].scope, scopes);

	scopes.pop();
}

function isComponent(candidate) {
	return Boolean(candidate) && typeof candidate == "object" && candidate.hasOwnProperty("_compiled");
}

injectComponents(components);

export default components;
`;

module.exports = async function genComponents() {
	const imports = [],
		files = {
			aaa: serialize.rawReplaceKey("...vueAdminComponents")
		};
	
	await traverseFileTree({
		cwd: path.join(__dirname, "../../components"),
		path: ""
	}, (node, acc) => {
		if (node.type == "directory") {
			acc[node.dirName] = {};
			return acc[node.dirName];
		}

		if (node.extension != "vue")
			return;

		const camelized = toDirCamelCase(node.path),
			pascalized = toPascalCase(node.fileName);

		if (invalidIdentifierCharRegex.test(pascalized)) {
			warn(`Refusing to import '${node.file}' as its corresponding PascalCased identifier (${pascalized}) is invalid. Consider renaming the file`);
			return;
		}

		imports.push(`import ${camelized} from "../../components/${node.path}";`);
		acc[pascalized] = serialize.raw(camelized);
	}, files);

	await writeFile(
		path.join(__dirname, "../gen/components.js"),
		prefix + imports.join("\n") + `
		
const components = ${serialize(files, {
	quote: ""
})}` + suffix);
};

function toDirCamelCase(pth) {
	return stripExtension(pth).split(/[\\/]/).map(comp => {
		return comp.replace(/[_-]+(.)/g, (match, capture) => {
			return capture.toUpperCase();
		}).replace(invalidIdentifierCharRegex, "_");
	}).join("_");
}

function toPascalCase(file) {
	return file.split(/[_-]+/)
		.map(s => s[0].toUpperCase() + s.substr(1))
		.join("");
}
