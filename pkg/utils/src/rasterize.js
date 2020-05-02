import { serializeDom } from "./dom";
import {
	composeOptionsTemplates,
	createOptionsObject
} from "./options";
import hasOwn from "./has-own";

const DISALLOWED_NODES = { svg: 1, use: 1, defs: 1 };
const ATTRIBUTES = "alignment-baseline:auto;baseline-shift:0px;color;color-interpolation:srgb;color-rendering:auto;direction:ltr;display:inline;dominant-baseline:auto;fill:/black|rgb\\(0, 0, 0\\)/;fill-opacity:1;fill-rule:nonzero;font-variant:normal;image-rendering:auto;line-height:normal;marker:none;marker-start:none;marker-mid:none;marker-end:none;opacity:1;overflow:visible;paint-order:normal;pointer-events:auto;shape-rendering:auto;stop-color:/black|rgb\\(0, 0, 0\\)/;stop-opacity:1;stroke:none;stroke-dasharray:none;stroke-dashoffset:0px;stroke-linecap:butt;stroke-linejoin:miter;stroke-miterlimit:4;stroke-opacity:1;stroke-width:1px;text-anchor:start;text-decoration:/^none/;text-rendering:auto;vector-effect:none;visibility:visible;white-space:normal;writing-mode:horizontal-tb"
	.split(";")
	.map(kv => {
		let [key, value = null] = kv.split(":");

		if (value && value[0] == "/")
			value = new RegExp(value.substring(1, value.length - 1));

		return [key, value];
	});

const optionsTemplates = composeOptionsTemplates({
	injectStyle: true,
	"2x": { scale: 2 },
	"3x": { scale: 2 },
	jpg: { mime: "image/jpeg" },
	jpeg: { mime: "image/jpeg" },
	webp: { mime: "image/webp" },
	blob: { format: "blob" },
	dataUrl: { format: "dataUrl" }
});

export default function rasterize(node, options = {}) {
	options = createOptionsObject(options, optionsTemplates);

	return new Promise(resolve => {
		if (!(node instanceof SVGElement))
			return resolve(null);

		const viewBox = node.viewBox.baseVal,
			scale = options.scale || 1,
			w = Math.floor((options.width || viewBox.width || node.width.baseVal.value) * scale),
			h = Math.floor((options.height || viewBox.height || node.height.baseVal.value) * scale);

		if (!(w * h))
			return resolve(null);

		const canvas = document.createElement("canvas"),
			ctx = canvas.getContext("2d"),
			img = new Image();

		canvas.width = w;
		canvas.height = h;

		img.onload = _ => {
			ctx.drawImage(img, 0, 0, w, h);

			if (options.format == "dataUrl")
				resolve(canvas.toDataURL(options.mime, options.quality));
			else
				canvas.toBlob(blob => resolve(blob), options.mime, options.quality);
		};

		img.src = "data:image/svg+xml;utf8," + encodeURIComponent(
			serialize(node, options)
		);
	});
}

function serialize(node, options) {
	return serializeDom(node, {
		processAttributes({ attributes, set, sourceNode }) {
			if (!options.injectStyle)
				return;

			if (hasOwn(DISALLOWED_NODES, sourceNode.tagName))
				return;

			const style = window.getComputedStyle(sourceNode);
			let styleStr = attributes.style || "";

			for (let i = 0, l = ATTRIBUTES.length; i < l; i++) {
				const [key, def] = ATTRIBUTES[i];

				if (def == null || hasOwn(attributes, key))
					continue;

				if (def instanceof RegExp) {
					if (def.test(style[key]))
						continue;
				} else if (style[key] == def)
					continue;

				styleStr += `; ${key}: ${style[key]}`;
			}

			set("style", styleStr);
		}
	});
}
