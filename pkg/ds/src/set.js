import {
	sym,
	alias,
	forEach
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

alias(Set.prototype, {
	values: SYM_ITER_KEY,
	add: "set"
});
