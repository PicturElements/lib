export default class InputBlock extends Array {
	constructor(...items) {
		super(...items);
		this.isInputBlock = true;
		this.type = "row";
	}
}
