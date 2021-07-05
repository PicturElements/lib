const convertFiles = require("./common/convert-files");

module.exports = {
	handle: options => {
		convertFiles(options, {
			name: "WebP",
			extension: "webp",
			extensions: /\.(?:png|jpe?g|tiff?|webp)$/,
			extensionsStr: "PNG/JPEG/TIFF/WEBP",
			optionStyle: `-$key $value`,
			defaultOptions: {
				q: 50
			},
			command: "cwebp $options $input -o $output",
			errorCode: ec => ec != 0
		});
	},
	helpText: "webp input/directory [output/directory] [--key=value]"
};
