// Duplicates of utility functions from the package, put here
// without to prevent circular dependency problems

function isObject(val) {
	return Object.prototype.toString.call(val) == "[object Object]";
}

export {
	isObject
};
