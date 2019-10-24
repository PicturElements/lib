const { coerceFilePath } = require("../../pkg/node-utils");

const splitOnComma = input => input.trim().split(/\s*,\s*/);

const getPackageFields = _ => ([
	{
		name: "name",
		value: "",
		precedence: 0
	}, {
		name: "version",
		value: "1.0.0",
		precedence: 0
	}, {
		name: "description",
		value: "",
		precedence: 10
	}, {
		name: "main",
		value: "",
		validate: input => /^[a-z0-9-._~()'!*:@,;\/]+$/i.test(input),
		process: input => coerceFilePath(input),
		precedence: 0
	}, {
		name: "scripts",
		value: {
			test: "jest",
			start: "node ../server.js"
		},
		precedence: 0
	}, {
		name: "repository",
		value: {
			type: "git",
			url: "git+https://github.com/PicturElements/lib.git",
			directory: ""
		},
		precedence: 0
	}, {
		name: "keywords",
		value: [],
		process: splitOnComma,
		precedence: 10
	}, {
		name: "author",
		value: "qtxr",
		precedence: 0
	}, {
		name: "license",
		value: "MIT",
		precedence: 0
	}, {
		name: "bugs",
		value: {
			url: "https://github.com/PicturElements/lib/issues"
		},
		precedence: 0
	}, {
		name: "homepage",
		value: "https://github.com/PicturElements/lib#readme",
		precedence: 0
	}, {
		name: "dependencies",
		value: {},
		precedence: 0
	}, {
		name: "devDependencies",
		value: {},
		precedence: 0
	}, {
		name: "files",
		value: ["/src", "/index.d.ts"],
		process: splitOnComma,
		precedence: 0
	}, {
		name: "qlib",
		fields: [
			{
				name: "pushes",
				value: 0,
				precedence: -1
			},
			{
				name: "expose",
				fields: [
					{
						name: "scripts",
						value: ["connect/feed.js"],
						process: input => splitOnComma(input).map(f => coerceFilePath(f, "js")),
						precedence: 0
					}, {
						name: "styles",
						value: [],
						process: input => splitOnComma(input).map(f => coerceFilePath(f, "css")),
						precedence: 0
					}
				]
			}, {
				name: "ui",
				value: [
					{
						type: "console",
						config: {}
					}
				],
				precedence: -1
			}
		],
		precedence: 10
	}
]);

module.exports = getPackageFields;
