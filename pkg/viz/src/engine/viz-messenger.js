import { remFromArr } from "@qtxr/utils";

export default class VizMessenger {
	constructor() {
		this.subscriberLists = {};
	}

	subscribe(recipients) {
		for (let k in recipients) {
			if (!recipients.hasOwnProperty(k))
				continue;

			const list = this.subscriberLists[k] || [];
			this.subscriberLists[k] = list;

			if (typeof recipients[k] == "function" && list.indexOf(recipients[k]) == -1)
				list.push(recipients[k].bind(this));
		}
	}

	unsubscribe(key, recipient) {
		const list = this.subscriberLists[key];

		if (list)
			remFromArr(list, recipient);
	}

	post(key, values) {
		if (this.subscriberLists.hasOwnProperty(key)) {
			const list = this.subscriberLists[key];
			for (let i = 0, l = list.length; i < l; i++)
				list[i](key, values);
		}

		if (key != "all")
			this.post("all", values);
	}
}
