import BaseInput, { INJECT } from "./base-input";
import {
	isObject,
	inject
} from "@qtxr/utils";

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

		if (this.multiple)
			this.value = this.value || [];

		if (!this.ignoreSize && !isObject(this.targetSize))
			throw new Error("Invalid targetSize input: if ignoreSize is not defined, targetSize must be an object with width and height properties");
	}

	[INJECT](value) {
		if (!value)
			return value;

		if (typeof this.inject == "function")
			return this.inject(value);

		if (this.multiple) {
			const outValue = [];
			value = value ?
				(Array.isArray(value) ? value : [value]) :
				[];

			for (let i = 0, l = value.length; i < l; i++)
				outValue.push(resolveMedia(value[i]));

			return outValue;
		} else
			return resolveMedia(value);
	}
}

function resolveMedia(data) {
	if (!data)
		return null;

	if (typeof data == "string") {
		return {
			data,
			mediaType: getMediaType(data)
		};
	}

	return data;
}

const dataUrlRegex = /^data:(.+)\/.+?;/i,
	imageExtensionRegex = /\.(?:jpe?g|png|gif|tiff?|webp|bmp)\b/i,
	videoExtensionRegex = /\.(?:mp4|flv|ogg|avi|mov|qt|wmw|webm)\b/i;

function getMediaType(url) {
	const dex = dataUrlRegex.exec(url);
	if (dex)
		return dex[1];

	if (imageExtensionRegex.test(url))
		return "image";

	if (videoExtensionRegex.test(url))
		return "video";

	return "image";
}

