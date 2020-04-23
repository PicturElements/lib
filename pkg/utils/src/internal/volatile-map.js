import { QNDMap } from "./poly";
import { getTime } from "../time";

export default class VolatileMap extends QNDMap {
	constructor(iterable) {
		super(iterable);
	}

	set(key, value, ttl) {
		const item = super.get(key);

		if (item)
			setValue(item, value, ttl, _ => super.delete(key));
		else {
			super.set(
				key,
				setValue({}, value, ttl, _ => super.delete(key))
			);
		}

		return this;
	}

	get(key) {
		const item = super.get(key);
		return item && item.value;
	}

	delete(key) {
		const item = super.get(key);

		if (item) {
			if (item.timeout > -1)
				clearTimeout(item.timeout);

			super.delete(key);
			return true;
		}

		return false;
	}
}

function setValue(item, value, ttl, invalidate) {
	item.value = value;

	if (typeof ttl != "number") {
		item.timeout = -1;
		return item;
	}

	item.expiresAt = getTime() + ttl;

	if (typeof item.timeout == "number" && item.timeout > -1)
		return item;

	item.timeout = setTimeout(_ => {
		const padding = item.expiresAt - getTime();

		if (padding > 0) {
			item.timeout = -1;
			setValue(item, item.value, padding, invalidate);
		} else
			invalidate();
	}, ttl);

	return item;
}
