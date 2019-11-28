import { hasAncestor } from "@qtxr/utils";
import BaseInput from "./base-input";

export default class Formatted extends BaseInput {
	constructor(name, options, form) {
		super(name, options, form, {
			formatters: Array
		});

		this.selection = null;
	}

	updateSelectionData(root) {
		const selection = window.getSelection();

		if (!hasAncestor(selection.anchorNode, root))
			return null;

		console.log(selection, root);
	}
}
