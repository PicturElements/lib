const path = require("path");
const {
	stat,
	mkdir,
	chdir,
	logNL,
	writeFile
} = require("./utils");

const getPackageFields = require("./data-getters/package-fields");
const JSONWriter = require("./json-writer");
const { booleanQuestion } = require("./form-utils");

const HOME_DIR = path.join(__dirname, ".."),
	PKG_DIR = "pkg",
	NPM_USER = "qtxr",
	README_URL = `https://github.com/PicturElements/lib/${PKG_DIR}/@name@#readme`;

module.exports = async function init(options, name) {
	const precedence = JSONWriter.calcPrecedenceFromCLIOptions(options);
	
	if (!name)
		return console.log("Failed to initialize package: name is not valid");
	
	const pkgPathLocal = path.join(PKG_DIR, name),
		pkgPath = path.join(HOME_DIR, pkgPathLocal);

	if (await stat(pkgPath))
		return console.log(`Failed to initialize package: '${name}' already exists`);

	// Set up package.json
	while (true) {
		const writer = new JSONWriter(getPackageFields(), {
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

	if (await booleanQuestion("Want to navigate to package?"))
		chdir(pkgPath);

	async function startInit(writer) {
		// Set up basic file structure
		await mkdir(pkgPath, {
			recursive: true
		});
		await mkdir(path.join(pkgPath, "dist"));
		await mkdir(path.join(pkgPath, "test"));

		// Write package.json
		const pkgJsonPath = path.join(pkgPath, "package.json"),
			pkgSuccess = await writer.write(pkgJsonPath, "  ");

		if (!pkgSuccess) {
			panic(pkgPath, `failed to write file at ${pkgJsonPath}`);
			return false;
		}

		// Write main file
		const mainPath = path.join(pkgPath, writer.get("main"));
		const mainSuccess = await writeFile(mainPath, "// TODO: write export code");

		if (!mainSuccess) {
			panic(pkgPath, `failed to write main file at ${mainPath}`);
			return false;
		}

		// Write main file
		const readmePath = path.join(pkgPath, "README.md");
		const readmeSuccess = await writeFile(readmePath, `## ${writer.get("name")}\n${writer.get("description")}`);

		if (!readmeSuccess) {
			panic(pkgPath, `failed to write README file at ${readmePath}`);
			return false;
		}

		// Write export file(s)
		const exposeFiles = [
			...(writer.get("qlib.expose.scripts") || []),
			...(writer.get("qlib.expose.styles") || [])
		];

		for (const file of exposeFiles) {
			const pth = path.join(pkgPath, file);
			const success = await writeFile(pth, "// TODO: add export");

			if (!success) {
				panic(pkgPath, `failed to write file at ${pth}`);
				return false;
			}
		}

		return true;
	}
};

function panic(pkgPath, reason) {
	console.log(`Panic: ${reason}\nPlease manually remove directory ${pkgPath}\n`);
}
