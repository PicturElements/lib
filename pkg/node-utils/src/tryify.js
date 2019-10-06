module.exports = function tryify(func, ...args) {
	try {
		func(...args);
		return true;
	} catch (e) {
		console.error(e);
		return false;
	}
};
