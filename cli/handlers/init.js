const path = require("path");
const {
	stat,
	mkdir,
	logNL,
	writeFile
} = require("../utils");

const getPackageFields = require("../data-getters/package-fields");
const getExposeDefault = require("../data-getters/expose-defaults");
const JSONForm = require("../json-form");
const { booleanQuestion } = require("../form-utils");

const { buildExposedAtPkg } = require("../../web/expose");

const HOME_DIR = path.join(__dirname, "../.."),
	PKG_DIR = "pkg",
	NPM_USER = "qtxr",
	README_URL = `https://github.com/PicturElements/lib/tree/master/${PKG_DIR}/@name@#readme`;

module.exports = async function init(options, name) {
	const precedence = JSONForm.calcPrecedenceFromCLIOptions(options);
	
	if (!name)
		return console.log("Failed to initialize package: name is not valid");
	
	const pkgPathLocal = path.join(PKG_DIR, name),
		pkgPath = path.join(HOME_DIR, pkgPathLocal);

	if (await stat(pkgPath))
		return console.log(`Failed to initialize package: '${name}' already exists`);

	// Set up package.json
	while (true) {
		const writer = new JSONForm(getPackageFields(), {
			questionType: "terse"
		});
		writer.set("name", `@${NPM_USER}/${name}`);
		writer.set("main", "index.js");
		writer.set("homepage", README_URL.replace("@name@", name));
		writer.get("repository").directory = pkgPathLocal;

		console.log("\nSetting up package.json:");
		await writer.cli(precedence);
		console.log("\nFinished setting up package.json:\n");
		logNL(writer.serialize("  "));

		if (await booleanQuestion()) {
			const success = await startInit(writer);

			if (!success)
				return;
			
			break;
		}
	}

	console.log(`\nSuccess! Created package ${name} in ${path.join(HOME_DIR, PKG_DIR)}`);

	async function startInit(writer) {
		// Set up basic file structure
		await mkdir(pkgPath, {
			recursive: true
		});
		await mkdir(path.join(pkgPath, "connect"));
		await mkdir(path.join(pkgPath, "doc"));
		await mkdir(path.join(pkgPath, "src"));
		await mkdir(path.join(pkgPath, "test"));

		const writeError = await writeFiles([
			{
				path: path.join(pkgPath, "package.json"),
				content: writer.serialize("  ")
			}, {
				path: path.join(pkgPath, writer.get("main")),
				content: "// TODO: write export code"
			}, {
				path: path.join(pkgPath, "README.md"),
				content: `## ${writer.get("name")}\n${writer.get("description")}`
			}, {
				path: path.join(pkgPath, "index.d.ts"),
				content: `declare module "${writer.get("name")}";`
			}, {
				path: path.join(pkgPath, ".gitignore"),
				content: ".DS_Store\nnode_modules\n/dist\n/coverage"
			}
		]);

		if (writeError) {
			panic(pkgPath, writeError);
			return false;
		}

		// Write export file(s)
		const exposeFiles = [
			...(writer.get("qlib.expose.scripts") || []),
			...(writer.get("qlib.expose.styles") || [])
		];

		for (const file of exposeFiles) {
			const pth = path.join(pkgPath, file),
				fileName = /([^.\/]+)(?:\.\w+)?$/.exec(file)[1];
			const success = await writeFile(pth, getExposeDefault(fileName));

			if (!success) {
				panic(pkgPath, `failed to write file at ${pth}`);
				return false;
			}
		}

		console.log("\nBuilding/bundling expose files");
		await buildExposedAtPkg(name, writer.extract());

		return true;
	}
};

function panic(pkgPath, reason) {
	console.log(`Panic: ${reason}\nPlease manually remove directory ${pkgPath}\n`);
}

async function writeFiles(files) {
	for (const file of files) {
		const success = await writeFile(file.path, file.content || "");
		if (!success)
			return file.err || `failed to write file at ${file.path}`;
	}

	return null;
}
