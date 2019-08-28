import forEach from "./for-each";
import { isObj } from "./is";

export default function forEachDeep(obj, callback, options) {
	if (!obj || typeof callback != "function")
		return;

	function iterate(ob) {
		forEach(ob, (e, k, o) => {
			callback(e, k, o);

			if (isObj(e))
				iterate(e);
		}, options);
	}
	
	iterate(obj);
}
