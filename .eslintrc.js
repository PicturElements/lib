const prod = process.env.NODE_ENV == "production";

module.exports = {
	extends: "eslint:recommended",
	env: {
		node: true,
		browser: true,
		es6: true,
		jest: true
	},
	parserOptions: {
		ecmaVersion: 10,
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
		"arrow-parens": ["warn", "as-needed"]
	}
};
