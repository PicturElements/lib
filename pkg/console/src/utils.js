import {
	parsePugStr,
	genDom
} from "@qtxr/utils";

function el(...args) {
	return genDom(parsePugStr(...args));
}

export {
	el
};
