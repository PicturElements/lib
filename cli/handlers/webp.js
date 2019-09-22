const {
	join,
	mkdir,
	exec,
	collectFileTree
} = require("../utils");
const { isObject } = require("../../utils");
const { booleanQuestion } = require("../form-utils");

const imgFileRegex = /\.(?:png|jpe?g|tiff?|webp)$/;

module.exports = async function webp(options, ioPaths, passedOptions) {
	const cwd = process.cwd(),
		ioPathSplit = ioPaths.split(":").map(p => join(cwd, p)),
		iPath = ioPathSplit[0],
		oPath = ioPathSplit[1] === undefined ? iPath : ioPathSplit[1];

	const cont = await booleanQuestion(`input:\t${iPath}\noutput:\t${oPath}\nok? (y/n)`);
	if (!cont)
		return;

	const tree = await collectFileTree(
		iPath,
		file => imgFileRegex.test(file),
		true
	);

	if (!tree)
		return console.log("Failed to exec webp: please run this command on a directory containing PNG/JPEG/TIFF/WEBP files");

	await mkdir(oPath, {
		recursive: true
	});

	let count = 0;

	async function convert(node, oPth) {
		for (const k in node) {
			const item = node[k],
				workingOPath = join(oPth, k);

			if (isObject(item)) {
				await mkdir(workingOPath);
				await convert(item, workingOPath);
			} else {
				const webpUrl = workingOPath.replace(imgFileRegex, ".webp");
				await exec(`cwebp ${passedOptions || ""} ${item} -o ${webpUrl}`);
				count++;
			}
		}
	}

	console.log("Found files; converting...");

	const startTime = Date.now();
	await convert(tree, oPath);
	console.log(`Converted ${count} files (${Date.now() - startTime} ms)`);
};
