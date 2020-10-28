import { resolveFunc } from "../function";

class Null {}

const isSetLike = resolveFunc(_ => {
	const SetConstructor = typeof Set != "undefined" ? Set : Null,
		WeakSetConstructor = typeof WeakSet != "undefined" ? WeakSet : Null;

	return candidate => {
		return candidate instanceof SetConstructor ||
			candidate instanceof WeakSetConstructor;
	};
});

const isMapLike = resolveFunc(_ => {
	const MapConstructor = typeof Map != "undefined" ? Map : Null,
		WeakMapConstructor = typeof WeakMap != "undefined" ? WeakMap : Null;

	return candidate => {
		return candidate instanceof MapConstructor ||
			candidate instanceof WeakMapConstructor;
	};
});

export {
	isSetLike,
	isMapLike
};
