const path = require("path");
const chokidar = require("chokidar");
const {
	stat,
	exists,
	rename,
	unlink,
	getFileName,
	stripExtension,
	readFileUTF,
	mkRenderer,
	splitDirAndFile,
	mkTemplateRenderer,
	bufferedFileInject,
	info,
	error,
	success
} = require("@qtxr/node-utils");

const genViewMap = require("./updaters/view-map");
const genComponentExport = require("./updaters/component-export");

const root = path.join(__dirname, "..");

async function init() {
	console.log("Running admin service...");

	watchModels();
	watchViews();
	watchComponents();

	await runAll();
}

async function runAll() {
	await genViewMap();
	await genComponentExport();
}

function watchModels() {
	chokidar.watch(path.join(root, "models"))
		.on("add", async pth => {
			info(`Added model at ${pth}`);
			await trackFile(pth);

			const {
					fileName,
					preset
				} = extractFileData(pth),
				correspondent = path.join("views", `${fileName}.vue`);

			const renamed = await getRenamedFile(pth);

			if (renamed) {
				await updateModel(fileName);
				await renameFile(
					getViewPath(getFileName(renamed)),
					getViewPath(fileName)
				);
				return;
			}

			if (!await exists(path.join(root, correspondent))) {
				const templatePath = await resolveViewTemplatePath(preset);

				renderView({
					root,
					targetPath: correspondent,
					templatePath,
					fileName
				});
			}

			const currentFileData = await readFileUTF(pth);

			if (!currentFileData.length) {
				// Remove old file
				if (pth != getModelPath(fileName))
					await unlink(pth);

				const templatePath = await resolveModelTemplatePath(preset);

				renderModel({
					root,
					targetPath: path.join("models", `${fileName}.js`),
					templatePath,
					fileName
				});
			}

			await genViewMap();
		})
		.on("unlink", async pth => {
			logRemovedFile(pth);
			info(`Removed model from ${pth}`);
			await genViewMap();
		});
}

function watchViews() {
	chokidar.watch(path.join(root, "views"))
		.on("add", async pth => {
			info(`Added view at ${pth}`);
			await trackFile(pth);

			const {
					fileName,
					preset
				} = extractFileData(pth),
				correspondent = path.join("models", `${fileName}.js`);

			const renamed = await getRenamedFile(pth);

			if (renamed) {
				await updateView(fileName);
				await renameFile(
					getModelPath(getFileName(renamed)),
					getModelPath(fileName)
				);
				return;
			}

			if (!await exists(path.join(root, correspondent))) {
				const templatePath = await resolveModelTemplatePath(preset);

				renderModel({
					root,
					targetPath: correspondent,
					templatePath,
					fileName
				});
			}

			const currentFileData = await readFileUTF(pth);

			if (!currentFileData.length) {
				// Remove old file
				if (pth != getViewPath(fileName))
					await unlink(pth);

				const templatePath = await resolveViewTemplatePath(preset);

				renderView({
					root,
					targetPath: path.join("views", `${fileName}.vue`),
					templatePath,
					fileName
				});
			}
			
			await genViewMap();
		})
		.on("unlink", async pth => {
			logRemovedFile(pth);
			info(`Removed view from ${pth}`);
			await genViewMap();
		});
}

function watchComponents() {
	chokidar.watch(path.join(root, "components"))
		.on("add", async pth => {
			info(`Added component at ${pth}`);

			const {
					file,
					fileName,
					preset
				} = extractFileData(pth),
				targetPath = path.join("components", `${fileName}.vue`);

			// Omit export file from export generation
			if (file == "index.js")
				return;

			const currentFileData = await readFileUTF(pth);

			if (!currentFileData.length) {
				const templatePath = await resolveComponentTemplatePath(preset);

				renderComponent({
					root,
					targetPath,
					templatePath,
					fileName
				});

				// Remove old file
				if (pth != getComponentPath(fileName))
					await unlink(pth);
			}

			await genComponentExport();
		})
		.on("unlink", async pth => {
			info(`Removed component from ${pth}`);
			await genComponentExport();
		});
}

async function renderView(args) {
	const {
		root,
		targetPath,
		templatePath,
		fileName
	} = args;

	const render = mkTemplateRenderer({
		root
	});

	render({
		struct: {
			[targetPath]: templatePath
		},
		templateData: {
			fileName,
			viewName: toPascal(fileName)
		}
	});

	success(`Added ${targetPath}`);
}

function renderModel(args) {
	const {
		root,
		targetPath,
		templatePath,
		fileName
	} = args;

	const render = mkTemplateRenderer({
		root
	});

	render({
		struct: {
			[targetPath]: templatePath
		},
		templateData: {
			viewTitle: toTitleCase(fileName),
			viewSidebarName: toTitleCase(fileName)
		}
	});

	success(`Added ${targetPath}`);
}

function renderComponent(args) {
	const {
		root,
		targetPath,
		templatePath,
		fileName
	} = args;

	const render = mkTemplateRenderer({
		root
	});

	render({
		struct: {
			[targetPath]: templatePath
		},
		templateData: {
			fileName,
			name: toPascal(fileName)
		}
	});

	success(`Added ${targetPath}`);
}

async function updateView(fileName) {
	await bufferedFileInject(getViewPath(fileName), [
		{
			matcher: {
				pre: /\.wrap\(/,
				body: /(["'`]).*?\1/
			},
			globalLine: true,
			matchScope: 0,
			injection: `"${fileName}"`,
			mode: "inline",
			annotate: false
		},
		{
			matcher: {
				pre: /\.wrap\(/,
				body: /name:\s*(["'`]).*?\1/
			},
			matchScope: 5,
			injection: `name: "${toPascal(fileName)}"`,
			mode: "inline",
			annotate: false
		}
	]);
}

async function updateModel(fileName) {
	await bufferedFileInject(getModelPath(fileName), [
		{
			matcher: {
				pre: /title:/,
				body: /(["'`]).*?\1/
			},
			matchScope: 0,
			injection: `"${toTitleCase(fileName)}"`,
			globalLine: true,
			mode: "inline",
			annotate: false
		},
		{
			matcher: {
				pre: /sidebar:\s*{/,
				body: /name:\s*(["'`]).*?\1/
			},
			matchScope: 5,
			injection: `name: "${toTitleCase(fileName)}"`,
			mode: "inline",
			annotate: false
		},
		{
			matcher: {
				pre: /breadcrumb:\s*{/,
				body: /name:\s*(["'`]).*?\1/
			},
			matchScope: 5,
			injection: `name: "${toTitleCase(fileName)}"`,
			mode: "inline",
			annotate: false
		}
	]);
}

async function renameFile(oldPath, newPath) {
	if (oldPath == newPath)
		return;

	if (await exists(newPath))
		toGarbage(newPath);

	const err = await rename(oldPath, newPath);

	if (err)
		error(`Failed to rename '${oldPath}' to '${newPath}'`);
	else
		success(`renamed '${oldPath}' to '${newPath}'`);
}

function toGarbage(pth) {
	const render = mkRenderer({
			targetPath: path.join(root, "runtime/garbage")
		}),
		fileName = splitDirAndFile(pth).file;

	render({
		[fileName]: pth
	});
}

function getModelPath(name) {
	return path.join(root, "models", `${name}.js`);
}

function getViewPath(name) {
	return path.join(root, "views", `${name}.vue`);
}

function getComponentPath(name) {
	return path.join(root, "components", `${name}.vue`);
}

function resolveModelTemplatePath(preset) {
	return resolveTemplatePath("runtime/templates/models/$file.js", preset);
}

function resolveViewTemplatePath(preset) {
	return resolveTemplatePath("runtime/templates/views/$file.vue", preset);
}

function resolveComponentTemplatePath(preset) {
	return resolveTemplatePath("runtime/templates/components/$file.vue", preset);
}

function toPascal(name) {
	return name.replace(/(?:^|-)(.)/g, (match, capture) => {
		return capture.toUpperCase();
	});
}

function toTitleCase(name) {
	return name.replace(/(?:^|-)(.)/g, (match, capture) => {
		return ` ${capture.toUpperCase()}`;
	}).trim();
}

const removedFiles = [],
	trackedFiles = {};

async function trackFile(pth) {
	const st = await stat(pth);

	trackedFiles[pth] = {
		stat: st,
		path: pth,
		valid: true
	};
}

async function logRemovedFile(pth) {
	const tracked = trackedFiles[pth];

	if (tracked)
		removedFiles.push(tracked);
}

async function getRenamedFile(pth) {
	const st = await stat(pth);

	for (let i = removedFiles.length - 1; i >= 0; i--) {
		const logEntry = removedFiles[i];

		if (logEntry.valid && logEntry.stat.birthtimeMs == st.birthtimeMs) {
			removedFiles.splice(i, 1);
			logEntry.valid = false;
			return logEntry.path;
		}
	}

	return null;
}

async function resolveTemplatePath(pth, preset, defaultName = "default") {
	const candidate = pth.replace("$file", preset);

	if (!preset || !await exists(path.join(root, candidate)))
		return pth.replace("$file", defaultName);

	return candidate;
}

function getFile(pth) {
	const split = pth.split(/\\|\//);
	return split[split.length - 1] || "";
}

function extractFileData(pth) {
	const [file, preset] = getFile(pth).split(":")
			.map(s => s.trim())
			.filter(Boolean),
		fileName = stripExtension(file);

	return {
		file,
		preset,
		fileName
	};
}

init();

module.exports = {
	runAll
};
