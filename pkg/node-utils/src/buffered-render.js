const fs = require("fs");
const path = require("path");
const { isObject } = require("./utils");
const { unlink } = require("./fs/file");
const { rmdir } = require("./fs/dir");

let bufferCount = 0;

function mkBufferedRenderer(args = {}) {
	return a => {
		return bufferedRender(
			a.api || args.api || {},
			a.root || args.root || "",
			a.bufferTarget || args.bufferTarget || "",
			a.templateTarget || args.templateTarget || "",
			a.struct || args.struct || {},
			Object.assign({}, args.templateData, a.templateData),
			Object.assign({}, args.ejsOptions, a.ejsOptions)
		);
	};
}

// This function has to be synchronous because api.render(string) is
function bufferedRender(api, root, bufferTarget, templateTarget, struct, templateData, ejsOptions) {
	if (isObject(templateTarget)) {
		ejsOptions = templateData;
		templateData = struct;
		struct = templateTarget;
		templateTarget = "";
	}

	bufferTarget = path.join(root, bufferTarget, String(bufferCount++));
	templateTarget = path.join(root, templateTarget);
	
	// Expand and clone file tree
	struct = build(struct);
	// Buffer file structure
	setUp(bufferTarget, templateTarget, struct);
	// Run main render on the new buffer
	api.render(bufferTarget, templateData, ejsOptions);
	// inject middleware that will clear the buffer after
	// the main render has been run. This is async because
	// it interfaces directly with the middleware queue
	api.render(_ => tearDown(bufferTarget, struct));
	
	return struct;
};

function build(struct, outStruct = {}) {
	if (!isObject(struct))
		return struct;

	for (const k in struct) {
		if (!struct.hasOwnProperty(k))
			continue;

		build(struct[k], unwrap(struct, outStruct, k));
	}

	return outStruct;
}

function unwrap(struct, outStruct, key) {
	const split = key.split("/"),
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
	return !isObject(node);
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

function getName(node, key) {
	if (typeof node == "string")
		return key;

	return node.name;
}

function setUp(bufferTarget, templateTarget, struct) {
	const run = (pth, s) => {
		for (const k in s) {
			if (!s.hasOwnProperty(k))
				continue;

			const node = s[k];
	
			if (isLeafNode(node)) {
				const srcPath = path.join(templateTarget, getPath(node)),
					destPath = path.join(pth, getName(node, k)),
					stat = fs.statSync(srcPath);

				setPath(srcPath, s, k);

				if (stat.isDirectory()) {
					// Prep node as new directory
					// This will clear non-string leaf nodes,
					// but this shouldn't have any adverse effects
					// since the replaced node is a directory which
					// doesn't require additional data
					s[k] = {};
					fs.mkdirSync(destPath);
					copyDir(srcPath, destPath, s[k]);
				} else
					copyFile(srcPath, destPath);
			} else {
				const dir = path.join(pth, k);
				fs.mkdirSync(dir, {
					recursive: true
				});
				run(dir, node);
			}
		}
	};

	run(bufferTarget, struct);
}

function copyFile(srcPath, destPath) {
	fs.copyFileSync(
		srcPath,
		destPath,
		err => {
			if (err)
				throw err;
		}
	);
}

function copyDir(srcPath, destPath, struct) {
	const copy = (pth, dPth, s) => {
		const files = fs.readdirSync(pth);

		for (const file of files) {
			const filePath = path.join(pth, file),
				destFilePath = path.join(dPth, file);

			if (fs.statSync(filePath).isDirectory()) {
				fs.mkdirSync(destFilePath, {
					recursive: true
				});
				s[file] = {};
				copyDir(filePath, destFilePath, s[file]);
			} else {
				s[file] = filePath;
				copyFile(filePath, destFilePath);
			}
		}
	};

	copy(srcPath, destPath, struct);
}

async function tearDown(bufferTarget, struct) {
	const run = async (pth, s) => {
		for (const k in s) {
			if (!s.hasOwnProperty(k))
				continue;

			const node = s[k];
	
			if (isLeafNode(node))
				await unlink(path.join(pth, getName(node, k)));
			else
				await run(path.join(pth, k), node);
		}

		await rmdir(pth);
	};

	await run(bufferTarget, struct);
}

module.exports = {
	mkBufferedRenderer,
	bufferedRender
};
