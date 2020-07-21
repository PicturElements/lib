// Duplicates of utility functions from the package, put here
// without to prevent circular dependency problems

function isObject(val) {
	if (!val || typeof val != "object")
		return false;

	const proto = Object.getPrototypeOf(val);
	return proto == null || proto == Object.prototype;
}

export {
	isObject
};
