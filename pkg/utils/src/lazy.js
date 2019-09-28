import { resolveFunc } from "./func";

// IMPORTANT: these functions are resolved lazily so that dependents
// may properly polyfill functionality. Therefore, it's important not
// to use these functions within this package at root level
// It's recommended that all polyfillable features that are referenced
// at root level be lazily resolved

// ====== ./is ======
const isSetLike = resolveFunc(_ => {
	return typeof Set == "undefined" ?
	_ => false :
	candidate => candidate instanceof Set
});

const isMapLike = resolveFunc(_ => {
	return typeof Map == "undefined" ?
	_ => false :
	candidate => candidate instanceof Map
});

export {
	isSetLike,
	isMapLike
};
