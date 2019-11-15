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
const genComponents = require("./updaters/components");

const ROOT = path.join(__dirname, ".."),
	ADMIN_PATH = ROOT,
	MODELS_RELATIVE_PATH = "models",
	MODELS_PATH = path.join(ROOT, MODELS_RELATIVE_PATH),
	VIEWS_RELATIVE_PATH = "views",
	VIEWS_PATH = path.join(ROOT, VIEWS_RELATIVE_PATH),
	COMPONENTS_RELATIVE_PATH = "components",
	COMPONENTS_PATH = path.join(ROOT, COMPONENTS_RELATIVE_PATH),
	STYLE_PATH = path.join(ROOT, "assets/scss");

async function init() {
	console.log("Starting admin service...");

	watchModels();
	watchViews();
	watchComponents();

	await runAll();
}

async function runAll() {
	await genViewMap();
	await genComponents();
}

function watchModels() {
	chokidar.watch(".", {
			persistent: true,
			cwd: MODELS_PATH
		})
		.on("add", async pth => {
			info(`Added model at ${pth}`);
			await trackFile(path.join(MODELS_PATH, pth));

			const {
					fileName,
					preset
				} = extractFileData(pth),
				absPath = path.join(MODELS_PATH, pth),
				strippedFilePath = stripExtension(pth),
				correspondent = path.join(VIEWS_RELATIVE_PATH, `${strippedFilePath}.vue`);

			const renamed = await getRenamedFile(absPath);

			if (renamed) {
				await updateModel(strippedFilePath);
				await renameFile(
					getViewPath(path.join(pth, "..", getFileName(renamed))),
					getViewPath(strippedFilePath)
				);
				return;
			}

			if (!await exists(path.join(ROOT, correspondent))) {
				const templatePath = await resolveViewTemplatePath(preset);

				renderView({
					root: ROOT,
					targetPath: correspondent,
					templatePath,
					fileName
				});
			}

			const currentFileData = await readFileUTF(absPath);

			if (!currentFileData.length) {
				// Remove old file
				if (pth != getModelPath(strippedFilePath))
					await unlink(absPath);

				const templatePath = await resolveModelTemplatePath(preset);

				renderModel({
					root: ROOT,
					targetPath: path.join(MODELS_RELATIVE_PATH, `${fileName}.js`),
					templatePath,
					fileName
				});
			}

			await genViewMap();
		})
		.on("unlink", async pth => {
			logRemovedFile(path.join(MODELS_PATH, pth));
			info(`Removed model from ${pth}`);
			await genViewMap();
		});
}

function watchViews() {
	chokidar.watch(".", {
			persistent: true,
			cwd: VIEWS_PATH
		})
		.on("add", async pth => {
			info(`Added view at ${pth}`);
			await trackFile(path.join(VIEWS_PATH, pth));

			const {
					fileName,
					preset
				} = extractFileData(pth),
				absPath = path.join(VIEWS_PATH, pth),
				strippedFilePath = stripExtension(pth),
				correspondent = path.join(MODELS_RELATIVE_PATH, `${strippedFilePath}.js`);

			const renamed = await getRenamedFile(absPath);

			if (renamed) {
				await updateView(strippedFilePath);
				await renameFile(
					getModelPath(path.join(pth, "..", getFileName(renamed))),
					getModelPath(strippedFilePath)
				);
				return;
			}

			if (!await exists(path.join(ROOT, correspondent))) {
				const templatePath = await resolveModelTemplatePath(preset);

				renderModel({
					root: ROOT,
					targetPath: correspondent,
					templatePath,
					fileName
				});
			}

			const currentFileData = await readFileUTF(absPath);

			if (!currentFileData.length) {
				// Remove old file
				if (pth != getViewPath(strippedFilePath))
					await unlink(absPath);

				const templatePath = await resolveViewTemplatePath(preset);

				renderView({
					root: ROOT,
					targetPath: path.join(VIEWS_RELATIVE_PATH, `${fileName}.vue`),
					templatePath,
					fileName
				});
			}
			
			await genViewMap();
		})
		.on("unlink", async pth => {
			logRemovedFile(path.join(VIEWS_PATH, pth));
			info(`Removed view from ${pth}`);
			await genViewMap();
		});
}

function watchComponents() {
	chokidar.watch(".", {
			persistent: true,
			cwd: COMPONENTS_PATH
		})
		.on("add", async pth => {
			info(`Added component at ${pth}`);

			const {
					file,
					fileName,
					preset
				} = extractFileData(pth),
				absPath = path.join(COMPONENTS_PATH, pth),
				strippedFilePath = stripExtension(pth),
				targetPath = path.join(COMPONENTS_RELATIVE_PATH, `${strippedFilePath}.vue`);

			// Omit export file from export generation
			if (file == "index.js")
				return;

			const currentFileData = await readFileUTF(absPath);

			if (!currentFileData.length) {
				const templatePath = await resolveComponentTemplatePath(preset);

				renderComponent({
					root: ROOT,
					targetPath,
					templatePath,
					fileName
				});

				// Remove old file
				if (absPath != getComponentPath(strippedFilePath))
					await unlink(absPath);
			}

			await genComponents();
		})
		.on("unlink", async pth => {
			info(`Removed component from ${pth}`);
			await genComponents();
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

	const targetDir = splitDirAndFile(path.join(ROOT, targetPath)).dir;

	render({
		struct: {
			[targetPath]: templatePath
		},
		templateData: {
			fileName,
			viewName: toPascal(fileName),
			adminPath: path.relative(targetDir, ADMIN_PATH),
			componentsPath: path.relative(targetDir, COMPONENTS_PATH),
			stylePath: path.relative(targetDir, STYLE_PATH)
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

	const targetDir = splitDirAndFile(path.join(ROOT, targetPath)).dir;

	render({
		struct: {
			[targetPath]: templatePath
		},
		templateData: {
			fileName,
			name: toPascal(fileName),
			adminPath: path.relative(targetDir, ADMIN_PATH),
			stylePath: path.relative(targetDir, STYLE_PATH)
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
			targetPath: path.join(ROOT, "runtime/garbage")
		}),
		fileName = splitDirAndFile(pth).file;

	render({
		[fileName]: pth
	});
}

function getModelPath(pth) {
	return path.join(MODELS_PATH, `${pth}.js`);
}

function getViewPath(pth) {
	return path.join(VIEWS_PATH, `${pth}.vue`);
}

function getComponentPath(pth) {
	return path.join(COMPONENTS_PATH, `${pth}.vue`);
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

	if (!preset || !await exists(path.join(ROOT, candidate)))
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
