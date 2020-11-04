const prod = process.env.NODE_ENV == "production";

module.exports = {
	extends: "eslint:recommended",
	env: {
		node: true,
		browser: true,
		es2020: true,
		jest: true
	},
	parserOptions: {
		ecmaVersion: 11,
		sourceType: "module"
	},
	rules: {
		semi: "error",
		"no-prototype-builtins": "warn",
		"no-console": prod ? "warn" : "off",
		"no-constant-condition": [
			"error",
			{
				checkLoops: false
			}
		],
		// Ignore _ variables, which are meant to be blank
		"no-unused-vars": [
			"warn",
			{
				args: "none",
				varsIgnorePattern: "^_+$"
			}
		],
		"no-undef": [
			"error",
			{
				typeof: true
			}
		],
		"arrow-parens": ["warn", "as-needed"],
		"no-unexpected-multiline": "off"
	},
	overrides: [
		{
			files: ["*.test.js"],
			rules: {
				"no-prototype-builtins": "off"
			}
		}
	]
};
