import {
	forEach,
	isArrayLike,
	sym
} from "@qtxr/utils";
import MapSetBase, {
	getFirstInsertionId,
	nextIterStepSingular
} from "./map-set-base";
import Iterator from "./map-set-iterator";

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

	forEach(callback, thisArg) {
		const order = this.insertionOrder;

		for (let i = 0; i < order.length; i++) {
			const item = order[i];
			callback.call(thisArg, item[1], item[0], this);
		}
	}

	values() {
		return new Iterator(
			this.insertionOrder,
			getFirstInsertionId(this.insertionOrder),
			iterator => nextIterStepSingular(iterator, 1)
		);
	}
}
