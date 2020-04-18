import Input, { INJECT } from "./input";
import {
	isObject,
	inject
} from "@qtxr/utils";

export default class Media extends Input {
	constructor(name, options, form) {
		options = inject(options, {
			mediaOptions: {
				type: "image/png",
				quality: 0.92,
				accept: "image/*"
			}
		}, "cloneTarget");

		super(name, options, form, {
			targetSize: {
				"w!": "number",
				"h!": "number"
			},
			multiple: "boolean",
			enforceSize: "boolean",
			ignoreSize: "boolean",
			mediaOptions: {
				type: "string",
				quality: "number",
				accept: "string"
			}
		});

		this.nullable = true;

		if (this.multiple)
			this.value = this.value || [];

		if (!this.ignoreSize && !isObject(this.targetSize))
			throw new Error("Invalid targetSize input: if ignoreSize is not defined, targetSize must be an object with width and height properties");
	}

	[INJECT](value) {
		value = typeof this.handlers.inject == "function" ?
			super[INJECT](value) :
			value;

		if (this.multiple) {
			const outValue = [];
			value = value ?
				(Array.isArray(value) ? value : [value]) :
				[];

			for (let i = 0, l = value.length; i < l; i++)
				outValue.push(this.vt(value[i]));

			return outValue;
		} else
			return this.vt(value);
	}
}

Media.formalize
	.if("string")
		.as("string")
		.to(d => ({
			data: d,
			mediaType: getMediaType(d)
		}))
		.from(d => d && d.data);

const dataUrlRegex = /^data:(.+)\/.+?;/i,
	imageExtensionRegex = /\.(?:jpe?g|png|gif|tiff?|webp|bmp)\b/i,
	videoExtensionRegex = /\.(?:mp4|flv|ogg|avi|mov|qt|wmw|webm)\b/i;

function getMediaType(url) {
	const dex = dataUrlRegex.exec(getDataUrlHeader(url));
	if (dex)
		return dex[1];

	if (imageExtensionRegex.test(url))
		return "image";

	if (videoExtensionRegex.test(url))
		return "video";

	return "image";
}

function getDataUrlHeader(url) {
	if (url[0] != "d")
		return "";

	let header = "",
		ptr = 0;

	while (ptr < 200 && url[ptr] != ",")
		header += url[ptr++];

	return header;
}
