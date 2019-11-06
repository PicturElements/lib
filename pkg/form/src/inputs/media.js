import BaseInput from "./base-input";
import { inject } from "@qtxr/utils";

export default class Media extends BaseInput {
	constructor(name, options, form) {
		options = inject(options, {
			mediaOptions: {
				type: "image/png",
				quality: 0.92,
				accept: "image/*"
			}
		}, "cloneTarget");

		super(name, options, form, {
			"targetSize!": {
				"w!": "number",
				"h!": "number"
			},
			multiple: "boolean",
			enforceSize: "boolean",
			mediaOptions: {
				type: "string",
				quality: "number",
				accept: "string"
			}
		});
	}
}
