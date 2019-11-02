import Input from "./input";
import { inject } from "@qtxr/utils";

export default class Image extends Input {
	constructor(name, options, form) {
		options = inject(options, {
			imageOptions: {
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
			imageOptions: {
				type: "string",
				quality: "number",
				accept: "string"
			}
		});
	}
}
