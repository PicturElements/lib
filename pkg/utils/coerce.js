import {
	isObj,
	isArrayLike
} from "./is";

function coerceToObj(val, source) {
	return isObj(val) ? val : (isArrayLike(source) ? [] : {});
}

function coerceNum(num, def) {
	return typeof num == "number" && !isNaN(num) ? num : def;
}

export {
	coerceToObj,
	coerceNum
};
