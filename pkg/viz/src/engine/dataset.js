import {
	hasOwn,
	equals,
	unenum,
	forEach
} from "@qtxr/utils";

const readonlyProps = {
	_originalData: 1,
	_owner: 1
};

export default class Dataset {
	constructor(data, owner) {
		data = data || {};
		owner = owner || null;

		forEach(data, (e, k) => {
			if (hasOwn(readonlyProps, k))
				throw new Error(`Action forbidden: Cannot override property "${k}".`);

			if (hasOwn(Dataset.prototype, k))
				console.warn(`Dataset prototype "${k}" has been overwritten by a custom value. This might not be intentional.`);

			this[k] = data[k];
		});

		unenum(this, "_originalData", data);
		unenum(this, "_owner", owner);
	}

	isLike(ds) {
		return equals(ds, this) || equals(ds, this._originalData);
	}

	setLegend(legend) {
		this.legend = legend;
	}
}
