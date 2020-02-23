import {
	forEach,
	isArrayLike,
	sym
} from "@qtxr/utils";
import MapSetBase from "./map-set-base";

export default class Map extends MapSetBase {
	constructor(iterable) {
		super(iterable);

		this.key = sym("MapPrivateKey");

		forEach(iterable, entry => {
			if (!isArrayLike(entry))
				throw new TypeError("Iterator value is not an entry object");

			this.add(entry[0], entry[1]);
		});
	}
}
