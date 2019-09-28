import forEach from "./for-each";
// An issue with circular references makes
// import { isObj } from "./is";

export default function forEachDeep(obj, callback, options) {
	if (!obj || typeof callback != "function")
		return;

	function iterate(ob) {
		forEach(ob, (e, k, o) => {
			callback(e, k, o);

			if (e && typeof e == "object")
				iterate(e);
		}, options);
	}
	
	iterate(obj);
}
