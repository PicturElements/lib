const getPackage = _ => {
	return {
		dependencies: {
			"@qtxr/vue-admin": "^2.0.0",
			"@qtxr/vue-wrap-component": "^2.5.3"
		},
		devDependencies: {
			"chokidar": "^3.2.1",
			"@qtxr/node-utils": "^1.7.0"
		},
		sass: {
			includePaths: ["node_modules"]	// Required to load SCSS files from node_modules
		}
	};
};

module.exports = getPackage;
