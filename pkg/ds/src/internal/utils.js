import {
	get,
	isPrimitive
} from "@qtxr/utils";

function getHash(ds, val) {
	const hashed = getHashHelper(ds, val);

	if (!isPrimitive(hashed))
		throw new Error(`Hash returned non-primitive value`);

	return hashed;
}

function getHashHelper(ds, val) {
	switch (typeof ds.hashResolver) {
		case "function":
			return ds.hashResolver(val);

		case "string":
			return get(val, ds.hashResolver);
	}

	return val;
}

function typeHash(hash) {
	if (typeof hash == "symbol")
		return hash;

	return typeof hash + ":" + hash;
}

export {
	getHash,
	typeHash
};
