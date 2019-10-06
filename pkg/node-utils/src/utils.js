function isObject(val) {
	return !!val && Object.getPrototypeOf(val) == Object.prototype;
}

function merge(target, source) {
	if (!source || typeof source != "object")
		return source;

	if (Array.isArray(source)) {
		if (!Array.isArray(target))
			target = [];

		for (let i = 0, l = source.length; i < l; i++)
			target[i] = merge(target[i], source[i]);
	} else {
		if (!target || typeof target != "object")
			target = {};

		for (const k in source) {
			if (!source.hasOwnProperty(k))
				continue;

			target[k] = merge(target[k], source[k]);
		}
	}

	return target;	
}

module.exports = {
	isObject,
	merge
};
