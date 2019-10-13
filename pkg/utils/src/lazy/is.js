import { resolveFunc } from "../func";

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
