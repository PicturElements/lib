import {
	isObj,
	isArrayLike,
	isArrResolvable
} from "./is";

function coerceToObj(val, source) {
	return isObj(val) ? val : (isArrayLike(source) ? [] : {});
}

function coerceToObjArrResolvable(val, source) {
	return isObj(val) ? val : (isArrResolvable(source) ? [] : {});
}

function coerceNum(num, def) {
	return typeof num == "number" && !isNaN(num) ? num : def;
}

export {
	coerceToObj,
	coerceToObjArrResolvable,
	coerceNum
};
