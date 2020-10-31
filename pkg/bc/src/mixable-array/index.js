import { Manage } from "../common";

export default class MixableArray extends Array {
	constructor(options) {
		super();
		Manage.instantiate(MixableArray, this, options);
	}

	[Manage.CONSTRUCTOR]() {}
}

Manage.declare(MixableArray, {
	name: "MixableArray",
	namespace: "mixableArray",
	extends: Array
});

