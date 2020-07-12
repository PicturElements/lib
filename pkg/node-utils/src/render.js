const fs = require("fs");
const path = require("path");
const serialize = require("./serialize");
const { isObject } = require("./utils");
const { unlink } = require("./fs/file");
const { rmdir } = require("./fs/dir");
const { splitDirAndFile } = require("./path/general");
const {
	warn,
	error
} = require("./io/console");

let bufferCount = 0;

function mkRenderer(args = {}) {
	return a => render({
		root: a.root || args.root || "",
		destTarget: a.destTarget || args.destTarget || "",
		srcTarget: a.srcTarget || args.srcTarget || "",
		struct: a.struct || args.struct || {},
		templateData: Object.assign({}, args.templateData, a.templateData),
		templateRenderer: a.templateRenderer || args.templateRenderer
	});
}

function mkTemplateRenderer(args = {}) {
	args = Object.assign({}, args);
	args.templateRenderer = (fileData, a) => {
		return fileData.replace(/%(\w+?)%/g, (match, key) => {
			return a.templateData && a.templateData.hasOwnProperty(key) ? a.templateData[key] : "";
		});
	};

	return mkRenderer(args);
}

function render(args) {
	let {
		root,
		destTarget,
		srcTarget,
		struct
	} = args;

	destTarget = path.join(root, destTarget);
	srcTarget = path.join(root, srcTarget);

	// Expand and clone file tree
	struct = build(struct);
	// Render and display a pretty error message on error
	try {
		mount(destTarget, srcTarget, struct, args);
	} catch (e) {
		warn(`Failed to render structure ${serialize(struct, {
			indentStr: "  ",
			quote: ""
		})}`);
		error(e, e.message);
	}
}

function mkVueRenderer(args = {}) {
	return a => {
		return vueRender({
			api: a.api || args.api || {},
			root: a.root || args.root || "",
			destTarget: a.destTarget || args.destTarget || "",
			srcTarget: a.srcTarget || args.srcTarget || "",
			struct: a.struct || args.struct || {},
			templateData: Object.assign({}, args.templateData, a.templateData),
			ejsOptions: Object.assign({}, args.ejsOptions, a.ejsOptions)
		});
	};
}

// This function has to be synchronous because api.render(string) is
function vueRender(args) {
	let {
		api,
		root,
		destTarget,
		srcTarget,
		struct,
		templateData,
		ejsOptions
	} = args;

	destTarget = path.join(root, destTarget, String(bufferCount++));
	srcTarget = path.join(root, srcTarget);

	// Expand and clone file tree
	struct = build(struct);

	// Make sure buffer cleanup doesn't fail
	try {
		// Buffer file structure
		mount(destTarget, srcTarget, struct, args);
		// Run main render on the new buffer
		api.render(destTarget, templateData, ejsOptions);
	} catch (e) {
		warn(`Failed to render structure ${serialize(struct, {
			indentStr: "  ",
			quote: ""
		})}`);
		error(e);
	}

	// inject middleware that will clear the buffer after
	// the main render has been run. This is async because
	// it interfaces directly with the middleware queue
	api.render(_ => tearDown(destTarget, struct));

	return struct;
}

function build(struct, outStruct = {}) {
	if (isLeafNode(struct))
		return struct;

	for (const k in struct) {
		if (!struct.hasOwnProperty(k))
			continue;

		build(struct[k], unwrap(struct, outStruct, k));
	}

	return outStruct;
}

function unwrap(struct, outStruct, key) {
	const split = key.split(/\\|\//),
		hasLeafNode = isLeafNode(struct[key]);

	for (let i = 0, l = split.length; i < l; i++) {
		const subKey = split[i];

		if (hasLeafNode && i == l - 1)
			outStruct[subKey] = struct[key];
		else {
			outStruct[subKey] = outStruct[subKey] || {};
			outStruct = outStruct[subKey];
		}
	}

	return outStruct;
}

function isLeafNode(node) {
	if (!isObject(node))
		return true;

	return isFileDataNode(node);
}

function isFileDataNode(node) {
	if (!node)
		return false;

	return node.hasOwnProperty("fileData");
}

function getPath(node) {
	if (typeof node == "string")
		return node;

	return node.path;
}

function setPath(pth, parent, key) {
	const node = parent[key];

	if (typeof node == "string")
		parent[key] = pth;
	else
		node.path = pth;
}

function mount(destTarget, srcTarget, struct, args) {
	const run = (pth, s) => {
		for (const k in s) {
			if (!s.hasOwnProperty(k))
				continue;

			const node = s[k];

			if (isLeafNode(node)) {
				const destPath = path.join(pth, k);

				if (isFileDataNode(node)) {
					writeFileDeep(destPath, node.fileData, args);
					continue;
				}

				const srcPath = path.join(srcTarget, getPath(node));
				setPath(srcPath, s, k);

				if (fs.statSync(srcPath).isDirectory()) {
					// Prep node as new directory
					// This will clear non-string leaf nodes,
					// but this shouldn't have any adverse effects
					// since the replaced node is a directory which
					// doesn't require additional data
					s[k] = {};
					fs.mkdirSync(destPath);
					copyDir(destPath, srcPath, s[k], args);
				} else
					copyFile(destPath, srcPath, args);
			} else {
				const dir = path.join(pth, k);
				fs.mkdirSync(dir, {
					recursive: true
				});
				run(dir, node);
			}
		}
	};

	run(destTarget, struct);
}

function copyFile(destPath, srcPath, args) {
	if (typeof args.templateRenderer == "function") {
		let fileData = fs.readFileSync(srcPath);

		if (fileData instanceof Buffer)
			fileData = fileData.toString();

		fs.writeFileSync(destPath, args.templateRenderer(fileData, args));
	} else {
		fs.copyFileSync(
			srcPath,
			destPath,
			err => {
				if (err)
					throw err;
			}
		);
	}
}

function copyDir(destPath, srcPath, struct, args) {
	const files = fs.readdirSync(srcPath);

	for (const file of files) {
		const destFilePath = path.join(destPath, file),
			srcFilePath = path.join(srcPath, file);

		if (fs.statSync(srcFilePath).isDirectory()) {
			fs.mkdirSync(destFilePath, {
				recursive: true
			});
			struct[file] = {};
			copyDir(destFilePath, srcFilePath, struct[file], args);
		} else {
			struct[file] = srcFilePath;
			copyFile(destFilePath, srcFilePath, args);
		}
	}
}

function writeFileDeep(pth, fileData, args) {
	const {
		dir,
		file
	} = splitDirAndFile(pth);

	if (!file)
		return false;

	fs.mkdirSync(dir, {
		recursive: true
	});

	if (typeof args.templateRenderer == "function") {
		if (fileData instanceof Buffer)
			fileData = fileData.toString();

		fileData = args.templateRenderer(fileData, args);
	}

	fs.writeFile(pth, fileData, err => {
		if (err)
			throw err;
	});

	return true;
}

async function tearDown(destTarget, struct) {
	const run = async (pth, s) => {
		for (const k in s) {
			if (!s.hasOwnProperty(k))
				continue;

			const node = s[k];

			if (isLeafNode(node))
				await unlink(path.join(pth, k));
			else
				await run(path.join(pth, k), node);
		}

		await rmdir(pth);
	};

	await run(destTarget, struct);
}

module.exports = {
	mkRenderer,
	mkTemplateRenderer,
	render,
	mkVueRenderer,
	vueRender
};
