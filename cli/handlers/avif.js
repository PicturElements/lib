const convertFiles = require("./common/convert-files");

module.exports = {
	handle: options => {
		convertFiles(options, {
			name: "AVIF",
			extension: "avif",
			extensions: /\.(?:jpe?g|png|y4m)$/,
			extensionsStr: "JPEG/PNG/Y4M",
			optionStyle: `--$key $value`,
			defaultOptions: {
				jobs: 4,
				speed: 8,
				min: 40,
				max: 63,
				minalpha: 40,
				maxalpha: 63
			},
			command: "avifenc $input --output $output $options",
			errorCode: 0
		});
	},
	helpText: "avif input/directory [output/directory] [--key=value]"
};
