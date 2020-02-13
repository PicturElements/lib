import {
	forEach,
	sym
} from "@qtxr/utils";
import { SYM_ITER_KEY } from "@qtxr/utils/internal";
import MapSetBase from "./map-set-base";

export default class Set extends MapSetBase {
	constructor(iterable) {
		super(iterable);

		this.key = sym("SetPrivateKey");

		forEach(iterable, entry => {
			this.add(entry);
		});
	}

	add(key) {
		return super.add(key, key);
	}

	values() {
		return this.keys();
	}
}

Set.prototype[SYM_ITER_KEY] = Set.prototype.values;
