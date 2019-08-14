import node from "../lib/node/js/node";

export default class Console {
	constructor(wrapper) {
		this.items = [];
	}

	log() {

	}

	warn() {

	}

	error() {

	}

	list() {

	}

	table() {

	}

	add(item) {
		this.render(item);
	}

	render(item) {
		switch (item.type) {
			case "warn":
				break;
		}
	}
}
