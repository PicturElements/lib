export default class FormRows extends Array {
	constructor(...items) {
		super(...items);
		this.isFormRows = true;
	}
}
