const colorClassifierRegex = /^(?:#|rgba?|hsla?|cmyk)/,
	hexRegex = /^#([\da-f]{3,8})$/i,
	rgbRegex = /^rgba?\(\s*([\de.+-]+(%?)\s*(,?)\s*(?:[\de.+-]+\2\s*\3\s*){1,2}?(?:\s*(\/)?\s*[\de.+-]+(%?))?)\s*\)$/,
	hslRegex = /^hsla?\(\s*([\de.+-]+(?:deg|g?rad|turn)?\s*(,?)\s*(?:[\de.+-]+%\s*\2\s*){1,2}?(?:\s*(\/)?\s*[\de.+-]+(%?))?)\s*\)$/,
	cmykRegex = /^cmyk\(\s*([\de.+-]+%\s*(,?)\s*(?:[\de.+-]+%\s*\2\s*){2}(?:[\de.+-]+%\s*))\)$/,
	transformRegex = /^(\w+)\s*([+\-*/]?=?|\w+)\s*([\de.-]+)$/;

const RAW_COLORS = "aliceblue|f0f8ff|antiquewhite|faebd7|aqua|0ff|aquamarine|7fffd4|azure|f0ffff|beige|f5f5dc|bisque|ffe4c4|black|000|blanchedalmond|ffebcd|blue|00f|blueviolet|8a2be2|brown|a52a2a|burlywood|deb887|cadetblue|5f9ea0|chartreuse|7fff00|chocolate|d2691e|coral|ff7f50|cornflowerblue|6495ed|cornsilk|fff8dc|crimson|dc143c|cyan|0ff|darkblue|00008b|darkcyan|008b8b|darkgoldenrod|b8860b|darkgray|a9a9a9|darkgreen|006400|darkgrey|a9a9a9|darkkhaki|bdb76b|darkmagenta|8b008b|darkolivegreen|556b2f|darkorange|ff8c00|darkorchid|9932cc|darkred|8b0000|darksalmon|e9967a|darkseagreen|8fbc8f|darkslateblue|483d8b|darkslategray|2f4f4f|darkslategrey|2f4f4f|darkturquoise|00ced1|darkviolet|9400d3|deeppink|ff1493|deepskyblue|00bfff|dimgray|696969|dimgrey|696969|dodgerblue|1e90ff|firebrick|b22222|floralwhite|fffaf0|forestgreen|228b22|fuchsia|f0f|gainsboro|dcdcdc|ghostwhite|f8f8ff|gold|ffd700|goldenrod|daa520|gray|808080|green|008000|greenyellow|adff2f|grey|808080|honeydew|f0fff0|hotpink|ff69b4|indianred|cd5c5c|indigo|4b0082|ivory|fffff0|khaki|f0e68c|lavender|e6e6fa|lavenderblush|fff0f5|lawngreen|7cfc00|lemonchiffon|fffacd|lightblue|add8e6|lightcoral|f08080|lightcyan|e0ffff|lightgoldenrodyellow|fafad2|lightgray|d3d3d3|lightgreen|90ee90|lightgrey|d3d3d3|lightpink|ffb6c1|lightsalmon|ffa07a|lightseagreen|20b2aa|lightskyblue|87cefa|lightslategray|789|lightslategrey|789|lightsteelblue|b0c4de|lightyellow|ffffe0|lime|0f0|limegreen|32cd32|linen|faf0e6|magenta|f0f|maroon|800000|mediumaquamarine|66cdaa|mediumblue|0000cd|mediumorchid|ba55d3|mediumpurple|9370db|mediumseagreen|3cb371|mediumslateblue|7b68ee|mediumspringgreen|00fa9a|mediumturquoise|48d1cc|mediumvioletred|c71585|midnightblue|191970|mintcream|f5fffa|mistyrose|ffe4e1|moccasin|ffe4b5|navajowhite|ffdead|navy|000080|oldlace|fdf5e6|olive|808000|olivedrab|6b8e23|orange|ffa500|orangered|ff4500|orchid|da70d6|palegoldenrod|eee8aa|palegreen|98fb98|paleturquoise|afeeee|palevioletred|db7093|papayawhip|ffefd5|peachpuff|ffdab9|peru|cd853f|pink|ffc0cb|plum|dda0dd|powderblue|b0e0e6|purple|800080|rebeccapurple|639|red|f00|rosybrown|bc8f8f|royalblue|4169e1|saddlebrown|8b4513|salmon|fa8072|sandybrown|f4a460|seagreen|2e8b57|seashell|fff5ee|sienna|a0522d|silver|c0c0c0|skyblue|87ceeb|slateblue|6a5acd|slategray|708090|slategrey|708090|snow|fffafa|springgreen|00ff7f|steelblue|4682b4|tan|d2b48c|teal|008080|thistle|d8bfd8|tomato|ff6347|transparent|0000|turquoise|40e0d0|violet|ee82ee|wheat|f5deb3|white|fff|whitesmoke|f5f5f5|yellow|ff0|yellowgreen|9acd32",
	COL_NAMES = {},
	COL_NAME_HASHES = {},
	DEF_COL_DATA = {
		rgba: [0, 0, 0, 0],
		source: null,
		space: null
	},
	DEF_COL_MASK = [0, 0, 0, 1],
	COMPONENT_KEYS = {},
	COMPONENT_DATA = [
		["r", "red", 0],
		["g", "green", 1],
		["b", "blue", 2],
		["a", "alpha", 3],
		["h", "hue", 0, "hsl"],
		["s", "saturation", 1, "hsl"],
		["l", "lightness", 2, "hsl"],
		["c", "cyan", 0, "cmyk"],
		["m", "magenta", 1, "cmyk"],
		["y", "yellow", 2, "cmyk"],
		["k", "key", 3, "cmyk"]
	],
	SWIZZLES = [
		["rgb", null, undefined, 3],
		["rgba", null],
		["hsl", "hsla", undefined, 3],
		["hsla", "hsla"],
		["cmyk", "cmyk", "rgb"]
	];

const oHOP = Object.prototype.hasOwnProperty,
	hasOwn = (o, k) => oHOP.call(o, k);

export default class Color {
	constructor(src, space, immutable) {
		this._rgba = [0, 0, 0, 0];
		this.source = null;
		this.space = null;

		// Enforce mutability. In other cases instances
		// may toggle their own mutability as they wish
		// at runtime, but if specified at init, the
		// state may not be changed
		if (typeof immutable == "boolean") {
			Object.defineProperty(this, "immutable", {
				enumerable: true,
				configurable: false,
				writable: false,
				value: immutable
			});
		} else
			this.immutable = false;

		if (src instanceof Color)
			this._set(src, space);
		else if (src != null) {
			const parsed = Color.parseRaw(src);
			this._set(parsed, space);
		}
	}

	_set(ref, space) {
		const rgba = ref._rgba || ref.rgba;
		this.source = ref.source;
		this.space = space || ref.space;
		this._rgba = rgba && rgba.slice();
		return this;
	}

	_checkImmutable() {
		if (this.immutable) {
			warn("Cannot modify: instance is immutable");
			return true;
		}

		return false;
	}

	clone(immutable = null) {
		return new Color(this, null, immutable);
	}

	toString(space = this.space) {
		return Color.stringify(this._rgba, space);
	}

	str(space) {
		return this.toString(space);
	}

	equals(src) {
		return Color.equals(this, src);
	}

	// %%%%%%%%%% IMMUTABLE TRANSFORM METHODS %%%%%%%%%%
	transform(transforms, operation = "set") {
		const c = new Color(this);

		const emit = (k, op, v) => {
			if (!isNum(v))
				return;

			if (!hasOwn(COMPONENT_KEYS, k))
				return;

			switch (op) {
				case "add":
				case "plus":
				case "+":
				case "+=":
					c[k] += v;
					break;

				case "sub":
				case "subtract":
				case "minus":
				case "-":
				case "-=":
					c[k] -= v;
					break;

				case "mul":
				case "multiply":
				case "times":
				case "*":
				case "*=":
					c[k] *= v;
					break;

				case "div":
				case "divide":
				case "over":
				case "/":
				case "/=":
					c[k] /= v;
					break;

				case "set":
				case "equals":
				case "=":
				default:
					c[k] = v;
			}
		};

		if (typeof transforms == "string")
			transforms = [transforms];

		if (Array.isArray(transforms)) {
			for (let i = 0, l = transforms.length; i < l; i++) {
				const transform = transforms[i];

				if (typeof transform != "string")
					continue;

				const ex = transformRegex.exec(transform.trim());
				if (!ex)
					continue;

				emit(ex[1], ex[2], Number(ex[3]));
			}
		} else if (transforms && typeof transforms == "object") {
			for (const k in transforms) {
				if (!hasOwn(transforms, k))
					continue;

				let key = k,
					value = transforms[k],
					op = operation;

				if (!hasOwn(COMPONENT_KEYS, k)) {
					const split = k.split("@");

					if (!hasOwn(COMPONENT_KEYS, split[1]))
						continue;

					op = split[0];
					key = split[1];
				}

				if (Array.isArray(value)) {
					op = value[0];
					value = value[1];
				}

				emit(key, op, value);
			}
		}

		return c;
	}

	t(...transforms) {
		return this.transform(transforms);
	}

	rotate(amount, unit, op = "add") {
		const rotation = parseRotation(amount, unit);
		return this.transform({ h: rotation }, op);
	}

	saturate(amount, op = "add") {
		return this.transform({ s: amount }, op);
	}

	desaturate(amount, op = "add") {
		return this.transform({ s: -amount }, op);
	}

	lighten(amount, op = "add") {
		return this.transform({ l: amount }, op);
	}

	darken(amount, op = "add") {
		return this.transform({ l: -amount }, op);
	}

	opacify(amount, op = "add") {
		return this.transform({ a: amount }, op);
	}

	transparentize(amount, op = "add") {
		return this.transform({ a: -amount }, op);
	}

	interpolate(src, weight = 0.5) {
		const c = this._rgba,
			c2 = getRGBA(src, true);

		return new Color([
			interpolate(c[0], c2[0], weight),
			interpolate(c[1], c2[1], weight),
			interpolate(c[2], c2[2], weight),
			interpolate(c[3], c2[3], weight)
		]);
	}

	mix(src, weight = 1) {
		return this.interpolate(src, weight / 2);
	}

	invert(weight = 1) {
		const c = this._rgba;

		return this.interpolate([
			255 - c[0],
			255 - c[1],
			255 - c[2]
		], weight);
	}

	contrast(src) {
		const col = src instanceof Color ? src : new Color(src),
			aLum = this.luminance,
			bLum = col.luminance;

		return aLum > bLum ?
			(aLum + 0.05) / (bLum + 0.05) :
			(bLum + 0.05) / (aLum + 0.05);
	}

	compare(src) {
		const reference = src instanceof Color ? src : new Color(src),
			contrast = this.contrast(reference);

		return {
			source: this,
			reference,
			contrast,
			aa: contrast >= 4.5,
			aaLarge: contrast >= 3,
			aaa: contrast >= 4.5,
			aaaLarge: contrast >= 7
		};
	}

	// %%%%%%%%%% COLOR PARSING %%%%%%%%%%
	static parse(src) {
		return new Color(src);
	}

	static parseRaw(src) {
		let space = null;

		if (Array.isArray(src)) {
			if (src.length < 4) {
				src = src.slice();

				for (let i = src.length; i < 4; i++)
					src[i] = DEF_COL_MASK[i];
			}

			src = coerceToRGBA(src);

			return {
				source: src,
				space: "rgba",
				rgba: src
			};
		}

		if (typeof src != "string") {
			warn(`Could not parse input (${src}) because it's not of a valid type`);
			return DEF_COL_DATA;
		}

		src = src.trim().toLowerCase();

		if (hasOwn(COL_NAMES, src))
			src = COL_NAMES[src];

		if (Color.cache[src])
			return Color.cache[src];

		const cls = colorClassifierRegex.exec(src);

		if (!cls) {
			warn(`Could not parse color string '${src}' because it's not of a valid type`);
			return DEF_COL_DATA;
		}

		let rgba = null;
		space = cls[0];

		switch (space) {
			case "#":
				rgba = Color.parseHex(src);
				space = "hex";
				break;

			case "rgb":
				rgba = Color.parseRGB(src);
				space = rgba && rgba.length == 3 ? "rgb" : "rgba";
				break;

			case "rgba":
				rgba = Color.parseRGBA(src);
				space = rgba && rgba.length == 3 ? "rgb" : "rgba";
				break;

			case "hsl":
				rgba = Color.parseHSL(src);
				space = rgba && rgba.length == 3 ? "hsl" : "hsla";
				break;

			case "hsla":
				rgba = Color.parseHSLA(src);
				space = rgba && rgba.length == 3 ? "hsl" : "hsla";
				break;

			case "cmyk":
				rgba = Color.parseCMYK(src);
				break;
		}

		if (!rgba)
			return DEF_COL_DATA;

		Color.cache[src] = {
			source: src,
			space,
			rgba: coerceToRGBA(rgba)
		};

		return Color.cache[src];
	}

	// ========== HEX ==========
	static parseHex(src) {
		const ex = hexRegex.exec(src),
			matchLen = ex && ex[1].length;

		if (!ex || (matchLen > 3 && matchLen % 2))	// 3 character hex is valid, 5 and 7 are not
			return warn(`Could not parse string '${src}' because it's not a valid hex value`);

		const hex = ex[1],
			rgba = [0, 0, 0, 255],
			isShorthand = matchLen < 6,
			tokenLen = isShorthand ? hex.length : hex.length / 2;

		for (let i = 0; i < tokenLen; i++) {
			if (isShorthand)
				rgba[i] = hexToDecimal(hex[i]) * 17;
			else
				rgba[i] = hexToDecimal(hex.substring(i * 2, (i + 1) * 2));
		}

		rgba[3] /= 255;
		return coerceToRGBA(rgba);
	}

	// ========== RGB(A) ==========
	static parseRGBA(src) {
		const rgba = parseRGBAHelper(src);

		if (!rgba)
			return warn(`Could not parse color string '${src}' because it's not a valid RGBA value`);

		return rgba;
	}

	static parseRGB(src) {
		return this.parseRGBA(src);
	}

	// ========== HSL ==========
	static parseHSLA(src) {
		const hsla = parseHSLAHelper(src);

		if (!hsla)
			return warn(`Could not parse color string '${src}' because it's not a valid HSLA value`);

		return hsla.length == 3 ?
			this.HSLtoRGB(hsla) :
			this.HSLAtoRGBA(hsla);
	}

	static parseHSL(src) {
		return this.parseHSLA(src);
	}

	// ========== CMYK ==========
	static parseCMYK(src) {
		const cmyk = parseCMYKHelper(src);

		if (!cmyk)
			return warn(`Could not parse color string '${src}' because it's not a valid CMYK value`);

		return this.CMYKtoRGB(cmyk);
	}

	// %%%%%%%%%% COLOR CONVERSION %%%%%%%%%%

	// Parameter value ranges:
	// H: <Q (mod 360, mapped to 0-360)> S:<Q, capped to 0-100> L:<Q, capped to 0-100>
	// Adapted from:
	// https://gist.github.com/mjackson/5311256#file-color-conversion-algorithms-js-L47
	static HSLtoRGB(hsl) {
		hsl = coerceParse(hsl);
		let [h, s, l] = hsl;
		h = (360 + (h % 360)) % 360 / 360;
		s = cap(s / 100, 0, 1);
		l = cap(l / 100, 0, 1);

		if (s) {
			const q = l < 0.5 ?
					l * (1 + s) :
					l + s - l * s,
				p = 2 * l - q;

			return [
				hueToRGB(p, q, h + 1 / 3) * 255,
				hueToRGB(p, q, h) * 255,
				hueToRGB(p, q, h - 1 / 3) * 255
			];
		}

		l *= 255;
		return [l, l, l];
	}

	static HSLAtoRGBA(hsla) {
		hsla = coerceParse(hsla);
		const rgba = this.HSLtoRGB(hsla);
		rgba[3] = isNum(hsla[3]) ? hsla[3] : 1;
		return rgba;
	}

	// Adapted from:
	// https://gist.github.com/mjackson/5311256#file-color-conversion-algorithms-js-L12
	static RGBtoHSL(rgb) {
		rgb = coerceParse(rgb);
		let [r, g, b] = rgb;

		if (r == g && g == b)
			return [0, 0, (r / 255) * 100];

		r = cap(r / 255, 0, 1);
		g = cap(g / 255, 0, 1);
		b = cap(b / 255, 0, 1);

		const max = Math.max(r, g, b),
			min = Math.min(r, g, b),
			mm = max + min,
			d = max - min;

		let h,
			s,
			l = mm / 2;

		s = l > 0.5 ?
			d / (2 - mm) :
			d / mm;

		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;

			case g:
				h = (b - r) / d + 2;
				break;

			case b:
				h = (r - g) / d + 4;
				break;
		}

		h /= 6;

		return [
			h * 360,
			s * 100,
			l * 100
		];
	}

	static RGBAtoHSLA(rgba) {
		rgba = coerceParse(rgba);
		const hsla = this.RGBtoHSL(rgba);
		hsla[3] = isNum(rgba[3]) ? rgba[3] : 1;
		return hsla;
	}

	static RGBtoCMYK(rgb) {
		rgb = coerceParse(rgb);
		const [r, g, b] = rgb.map(comp => cap(comp / 255, 0, 1)),
			k = 1 - Math.max(r, g, b),
			luma = (1 - k) / 100;

		if (!luma)
			return [0, 0, 0, 100];

		return [
			(1 - r - k) / luma,
			(1 - g - k) / luma,
			(1 - b - k) / luma,
			k * 100
		];
	}

	static CMYKtoRGB(cmyk) {
		cmyk = coerceParse(cmyk);
		const [c, m, y, k] = cmyk.map(comp => cap(comp / 100, 0, 1)),
			luma = 1 - k;

		return [
			255 * (1 - c) * luma,
			255 * (1 - m) * luma,
			255 * (1 - y) * luma
		];
	}

	// %%%%%%%%%% UTILS AND ADVANCED FEATURES %%%%%%%%%%
	static stringify(src, space = "rgba") {
		const c = getRGBA(src, true);

		if (space == "auto") {
			const hash = c.join("-");

			if (hasOwn(COL_NAME_HASHES, hash))
				return COL_NAME_HASHES[hash];

			space = c[3] == 1 ? "rgb" : "rgba";
		}

		switch (space) {
			case "hex":
				return `#${buildHex(c)}`;

			case "hsl": {
				const hsl = coerceToHSLA(this.RGBtoHSL(c));
				return hsl ? `hsl(${hsl[0]}, ${hsl[1]}%, ${hsl[2]}%)` : "";
			}

			case "hsla": {
				const hsla = coerceToHSLA(this.RGBAtoHSLA(c));
				return `hsla(${hsla[0]}, ${hsla[1]}%, ${hsla[2]}%, ${hsla[3]})`;
			}

			case "cmyk": {
				const cmyk = coerceToCMYK(this.RGBtoCMYK(c));
				return `cmyk(${cmyk[0]}%, ${cmyk[1]}%, ${cmyk[2]}%, ${cmyk[3]}%)`;
			}

			case "rgb":
				return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

			default:
				return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${c[3]})`;
		}
	}

	static equals(src, src2) {
		if (src == src2)
			return true;

		const c = getRGBA(src),
			c2 = getRGBA(src2);

		for (let i = 0, l = c.length; i < l; i++) {
			if (c[i] != c2[i])
				return false;
		}

		return true;
	}

	static contrast(src, src2) {
		if (src instanceof Color)
			return src.contrast(src2);

		const col = new Color(src);
		return col.contrast(src2);
	}

	static compare(src, src2) {
		if (src instanceof Color)
			return src.compare(src2);

		const col = new Color(src);
		return col.compare(src2);
	}

	static gradient(...stops) {
		return new Gradient(...stops);
	}

	static interpolate(gradient, at) {
		if (!(gradient instanceof Gradient))
			return;

		at = Math.max(Math.min(at, 1), 0);
		return gradient.interpolate(at);
	}

	// %%%%%%%%%% COMPUTED PROPERTIES %%%%%%%%%%
	// https://planetcalc.com/7779
	// https://www.w3.org/TR/WCAG20/#relativeluminancedef
	get luminance() {
		const [r, g, b] = this._rgba;
		return (toLinear(r) * 0.2126) + (toLinear(g) * 0.7152) + (toLinear(b) * 0.0722);
	}

	get isDark() {
		return this.luminance < 0.5;
	}

	get isLight() {
		return this.luminance >= 0.5;
	}

	get complement() {
		return this.rotate(180);
	}

	get grayscale() {
		return this.transform({ s: 0 }, "set");
	}
}

Color.suppressWarnings = false;
Color.supportedColorSpaces = ["hex", "rgb", "hsl", "cmyk"];
Color.cache = Object.create(null);
Color.NULL = new Color([0, 0, 0, 0]);

class Gradient extends Array {
	constructor(...stops) {
		super();

		for (let i = 0, l = stops.length; i < l; i++)
			this._addStop(stops[i]);

		this.normalizeStopPositions();
	}

	// Allowed stop formats:
	// "<col-string>", ...
	// ["<col-string>", <at, 0-1>], ...
	// "<col-string> <at, 0-100>%, ..."
	// or any combination of the above (not recommended)
	_addStop(stop) {
		const stopData = stop && stop.isGradientStop ?
			stop :
			parseGradientStop(stop);

		if (Array.isArray(stopData)) {
			for (let i = 0, l = stopData.length; i < l; i++)
				this.push(stopData[i]);
		} else if (stopData)
			this.push(stopData);
	}

	addStop(stop) {
		this._addStop(stop);
		this.normalizeStopPositions();
		return this;
	}

	normalizeStopPositions() {
		if (!this.length)
			return;

		if (!isNum(this[0].at))
			this[0].at = 0;

		if (!isNum(this[this.length - 1].at))
			this[this.length - 1].at = 1;

		const len = this.length;
		let backlog = 0,
			prevPosition = 0;

		for (let i = 0; i < len; i++) {
			const item = this[i],
				at = item.at;

			if (!isNum(at)) {
				backlog++;
				continue;
			}

			if (backlog) {
				const step = (at - prevPosition) / (backlog + 1);
				while (backlog)
					this[i - backlog].at = at - (backlog--) * step;
			}

			prevPosition = at;
		}

		this.sort((a, b) => compare(a.at, b.at));
	}

	interpolate(at = 0, space = "rgba") {
		if (!this.length)
			return Color.stringify(Color.defaults.transparents, space);

		let start = 0,
			end = this.length - 1,
			pivot,
			pivotPos,
			basis;

		while (true) {
			if (end - start < 2) {
				basis = start;

				if (this[start].at > at)
					basis = start - 1;
				else if (this[end].at < at)
					basis = end;

				break;
			}

			pivot = Math.floor((start + end) / 2);
			pivotPos = this[pivot].at;

			if (pivotPos > at)
				end = pivot;
			else
				start = pivot;
		}

		const from = this[Math.max(basis, 0)],
			to = this[Math.min(basis + 1, this.length - 1)];

		return Gradient.doInterpolation(
			from.color,
			to.color,
			(to.at - at) / (to.at - from.at || to.at),
			space
		);
	}

	// from, to, at, runtime signature is specified by @qtxr/interpolate/interpolator
	static doInterpolation(from, to, at, runtime, space = "rgba") {
		const toRGBA = to._rgba,
			rgba = from._rgba.map((c, i) => (c * at) + (toRGBA[i] * (1 - at)));

		return Color.stringify(rgba, space);
	}
}

Gradient.cache = Object.create(null);
Gradient.NULL = new Gradient();

const gradientStopRegex = /(#\w{3,8}|(?:rgba?|hsla?)\(.*?\)|[a-z]+)|([\de.+-]+)%|,/gi;

function parseGradientStop(stopFmt) {
	gradientStopRegex.lastIndex = 0;

	let currentStop = null,
		lastStop = null,
		stopArr = null;

	if (stopFmt instanceof Gradient)
		return stopFmt;

	if (Array.isArray(stopFmt)) {
		return {
			color: new Color(stopFmt[0]),
			at: stopFmt[1],
			isGradientStop: true
		};
	}

	if (typeof stopFmt != "string")
		return null;

	if (Gradient.cache[stopFmt])
		return Gradient.cache[stopFmt];

	while (true) {
		const ex = gradientStopRegex.exec(stopFmt);
		if (!ex)
			break;

		if (ex[1]) {
			if (currentStop)
				return warn(`Malformed gradient '${stopFmt}' (stop already defined)`);

			if (lastStop && !stopArr)
				stopArr = [lastStop];

			currentStop = {
				color: new Color(ex[1]),
				at: null,
				isGradientStop: true
			};

			lastStop = currentStop;
			if (stopArr)
				stopArr.push(currentStop);
		} else if (ex[2]) {
			if (!currentStop)
				return warn(`Malformed gradient '${stopFmt}' (position before color)`);
			if (currentStop.at != null)
				return warn(`Malformed gradient '${stopFmt}' (position already specified)`);

			currentStop.at = Number(ex[2]) / 100;
		} else if (ex[0] == ",")
			currentStop = null;
	}

	if (stopArr)
		Gradient.cache[stopFmt] = new Gradient(...stopArr);
	else if (currentStop)
		Gradient.cache[stopFmt] = currentStop;

	return stopArr || currentStop;
}

// %%%%%%%%%% COLOR PARSING HELPERS %%%%%%%%%%
// ========== HEX ==========
// Assumes string is well formed
function hexToDecimal(str) {
	let out = 0,
		multiplier = 1;

	for (let i = str.length - 1; i >= 0; i--) {
		out += charToDec(str[i]) * multiplier;
		multiplier <<= 4;
	}

	return out;
}

// Defined for 0-9 and a-z (lower or upper case)
function charToDec(char) {
	const charCode = char.charCodeAt(0);
	if (charCode < 58)
		return charCode - 48;

	return 10 + (charCode - 65) % 32;
}

// ========== RGB(A) ==========
const rgbaSeparatorProfiles = mkLookup(",,", ",,,", "ss", "ss/"),
	rgbaPercMap = [255, 255, 255, 1];

function parseRGBAHelper(str) {
	const ex = rgbRegex.exec(str);

	if (!ex)
		return null;

	const paramsData = parseNumericParams(ex[1], rgbaPercMap);

	if (!paramsData || !rgbaSeparatorProfiles.has(paramsData.separatorProfile))
		return null;

	// If the returned parameters are RGB data, and the last parameter
	// has a unit that differs from the rest, it's invalid syntax
	if (ex[2] != ex[5] && paramsData.params.length == 3)
		return null;

	return paramsData.params;
}

// ========== HSL(A) ==========
const hslaSeparatorProfiles = mkLookup(",,", ",,,", "ss", "ss/"),
	hslaPercMap = [1, 100, 100, 1];

// hsl regex capture groups
// 1: full match inside parentheses (trimmed)
// 2: param separator (comma (normal), none (whitespace))
// 3: whitespace alpha separator (/)
function parseHSLAHelper(str) {
	const ex = hslRegex.exec(str);

	if (!ex)
		return null;

	if (ex[2] && ex[3]) // comma format and whitespace alpha separator are incompatible
		return null;

	const paramsData = parseNumericParams(ex[1], hslaPercMap);

	if (!paramsData || !hslaSeparatorProfiles.has(paramsData.separatorProfile))
		return null;

	// If no % was matched for the last parameter, but the returned parameters
	// only contain HSL data, there's a syntax error
	if (!ex[4] && paramsData.params.length == 3)
		return null;

	return paramsData.params;
}

// ========== CMYK ==========
const cmykSeparatorProfiles = mkLookup(",,,", "sss"),
	cmykPercMap = [100, 100, 100, 100];

function parseCMYKHelper(str) {
	const ex = cmykRegex.exec(str);

	if (!ex)
		return null;

	const paramsData = parseNumericParams(ex[1], cmykPercMap);

	if (!paramsData || !cmykSeparatorProfiles.has(paramsData.separatorProfile))
		return null;

	return paramsData.params;
}

// %%%%%%%%%% COLOR PARSING HELPERS %%%%%%%%%%

// Creates an object of numeric parameters
// and an accompanying string representing the parameter separators
// If any parameter is not numeric, null is returned
function parseNumericParams(str, percMap) {
	// Separator capture groups:
	// 3 / 4: comma (,) / slash (/)
	// 4: space (s)
	const paramSeparatorRegex = /([\de.+-]+)(%|\w*)|\s*([,/])\s*|(\s+)/g,
		params = [];
	let separatorProfile = "",
		lastWasNumber = false,
		paramCount = 0;

	while (true) {
		const ex = paramSeparatorRegex.exec(str);
		if (!ex)
			break;

		if (ex[4] || (ex[1] && lastWasNumber))	// 0-width separator (i.e. number + number ) counts as a space
			separatorProfile += "s";
		else if (ex[3])
			separatorProfile += ex[3];

		lastWasNumber = false;

		if (ex[1]) {
			let num = Number(ex[1]);
			if (isNaN(num))
				return null;

			switch (ex[2]) {
				case "%":
					if (percMap && typeof percMap[paramCount] == "number")
						num *= percMap[paramCount];
					num /= 100;
					break;

				default:
					num = parseRotation(num, ex[2]);
			}

			params.push(num);
			lastWasNumber = true;
			paramCount++;
		}
	}

	return {
		params,
		separatorProfile
	};
}

// %%%%%%%%%% COLOR CNVERSION HELPERS %%%%%%%%%%
// ========== HSL(A) ==========
function hueToRGB(p, q, t) {
	if (t < 0)
		t += 1;
	if (t > 1)
		t -= 1;

	if (t < 1 / 6)
		return p + (q - p) * 6 * t;
	if (t < 1 / 2)
		return q;
	if (t < 2 / 3)
		return p + (q - p) * (2 / 3 - t) * 6;

	return p;
}

// %%%%%%%%%% COLOR STRINGIFYING HELPERS %%%%%%%%%%
// ========== HEX(A) ==========
function buildHex(rgba) {
	const isShorthand = isShorthandHex(rgba),
		alpha = Math.round(rgba[3] * 255);
	let out = "";

	for (let i = 0; i < 3; i++)
		out += decimalToHex(rgba[i], isShorthand);

	if (alpha != 255)
		out += decimalToHex(alpha, isShorthand);

	return out;
}

function decimalToHex(dec, isShorthand) {
	if (isShorthand)
		dec %= 16;

	let out = "";

	if (!isShorthand)
		out += Math.floor(dec / 16).toString(16);

	return out + (dec % 16).toString(16);
}

function isShorthandHex(rgba) {
	for (let i = 0; i < 3; i++) {
		if (!isShorthandHexComponent(rgba[i]))
			return false;
	}

	return isShorthandHexComponent(Math.round(rgba[3] * 255));
}

function isShorthandHexComponent(dec) {
	return dec % 17 == 0;
}

// %%%%%%%%%% GENERAL HELPERS %%%%%%%%%%
// RGBA format [255, 255, 255, 1]
function coerceToRGBA(rgba, clone) {
	if (!Array.isArray(rgba))
		return warn(`${rgba} is not an RGB(A) array`) || getNullArr();

	if (clone)
		rgba = rgba.slice();

	if (rgba.length < 3 || rgba.length > 4)
		return warn(`Invalid RGB(A) length for format [${rgba}]: format must contain 3-4 components`) || getNullArr();

	if (rgba.length == 3)
		rgba.push(1);

	for (let i = 0; i < 3; i++)
		rgba[i] = roundCap(rgba[i], 0, 255);
	rgba[3] = roundCap(rgba[3], 0, 1, 2);

	if (rgba.some(isNaN))
		return warn("Invalid RGB(A) format: invalid components") || getNullArr();

	return rgba;
}

// HSLA format: [360, 100, 100, 1]
function coerceToHSLA(hsla, clone) {
	if (!Array.isArray(hsla))
		return warn(`${hsla} is not an HSL(A) array`) || getNullArr();

	if (clone)
		hsla = hsla.slice();

	if (hsla.length < 3 || hsla.length > 4)
		return warn(`Invalid HSL(A) length for format [${hsla}]: format must contain 3-4 components`) || getNullArr();

	if (hsla.length == 3)
		hsla.push(1);

	hsla[0] = roundCap((360 + (hsla[0] % 360)) % 360, 0, 360);
	hsla[1] = roundCap(hsla[1], 0, 100);
	hsla[2] = roundCap(hsla[2], 0, 100);
	hsla[3] = roundCap(hsla[3], 0, 1, 2);

	if (hsla.some(isNaN))
		return warn("Invalid HSL(A) format: invalid components") || getNullArr();

	return hsla;
}

// CMYK format: [100, 100, 100, 100]
function coerceToCMYK(cmyk, clone) {
	if (!Array.isArray(cmyk))
		return warn(`${cmyk} is not an CMYK array`) || getNullArr();

	if (clone)
		cmyk = cmyk.slice();

	if (cmyk.length != 4)
		return warn(`Invalid CMYK length for format [${cmyk}]: format must contain 4 components`) || getNullArr();

	for (let i = 0; i < 4; i++)
		cmyk[i] = roundCap(cmyk[i], 0, 100);

	if (cmyk.some(isNaN))
		return warn("Invalid CMYK format: invalid components") || getNullArr();

	return cmyk;
}

function cap(n, min, max) {
	n = Number(n);
	return Math.max(Math.min(n, max), min);
}

function roundCap(n, min, max, accuracy = null) {
	n = Number(n);

	if (accuracy) {
		accuracy = Math.pow(10, accuracy);
		return Math.max(Math.min(Math.round(n * accuracy) / accuracy, max), min);
	}

	return Math.max(Math.min(Math.round(n), max), min);
}

// Could use !Number.isNaN, but this has better compat
function isNum(candidate) {
	return typeof candidate == "number" && !isNaN(candidate);
}

function warn(warning) {
	if (!Color.suppressWarnings)
		console.warn(warning);

	return null;
}

function mkLookup(...items) {
	const lookup = {
		store: Object.create(null),
		has(key) {
			return this.store[key] != null;
		}
	};

	items.forEach((k, i) => lookup.store[k] = i);
	return lookup;
}

const unitValueRegex = /^([\de.-]+)(\w+)$/;

function parseRotation(value, unit) {
	if (!unit && typeof value == "string") {
		const ex = unitValueRegex.exec(value);
		if (!ex)
			return warn(`Failed to parse value/unit pair '${value}'`);

		value = Number(ex[1]);
		unit = ex[2];
	}

	switch (unit) {
		case "rad":
			value = (value / Math.PI) * 180;
			break;

		case "grad":
			value = (value / 400) * 360;
			break;

		case "turn":
			value *= 360;
			break;
	}

	return value;
}

function compare(a, b) {
	if (a == b)
		return 0;

	return a > b ? 1 : -1;
}

function interpolate(a, b, weight) {
	return a + (b - a) * weight;
}

// https://planetcalc.com/7779
// https://www.w3.org/TR/WCAG20/#relativeluminancedef
function toLinear(component) {
	const n = component / 255;

	return component > 0.03928 ?
		Math.pow (((n + 0.055) / 1.055), 2.4) :
		n / 12.92;
}

function coerceParse(arrOrStr) {
	if (Array.isArray(arrOrStr))
		return arrOrStr;

	const parsed = Color.parseRaw(arrOrStr);
	if (!parsed || !parsed.rgba)
		return DEF_COL_DATA.rgba;

	return parsed.rgba;
}

function getRGBA(arrColorOrStr, clone = false) {
	if (arrColorOrStr instanceof Color)
		return arrColorOrStr._rgba;

	return coerceToRGBA(
		coerceParse(arrColorOrStr),
		clone
	);
}

function getNullArr() {
	return [0, 0, 0, 0];
}

(_ => {
	const cd = RAW_COLORS.split("|");

	for (let i = 0, l = cd.length; i < l; i += 2) {
		const keyword = cd[i];

		COL_NAMES[keyword] = "#" + cd[i + 1];

		const col = new Color(COL_NAMES[keyword], null, true),
			hash = col._rgba.join("-");

		Color[keyword] = col;
		Color[keyword.toUpperCase()] = col;
		COL_NAME_HASHES[hash] = keyword;
	}

	const descriptors = {};

	for (let i = 0, l = COMPONENT_DATA.length; i < l; i++) {
		const [
			key,
			alias,
			index,
			space
		] = COMPONENT_DATA[i];

		if (space) {
			const toKey = `RGBto${space.toUpperCase()}`,
				fromKey = `${space.toUpperCase()}toRGB`;

			descriptors[key] = {
				get() {
					return Color[toKey](this._rgba)[index];
				},
				set(value) {
					if (this._checkImmutable())
						return;

					const converted = Color[toKey](this._rgba);
					converted[index] = value;
					this._rgba = Color[fromKey](converted);
				}
			};
		} else {
			descriptors[key] = {
				get() {
					return this._rgba[index];
				},
				set(value) {
					if (this._checkImmutable())
						return;

					this._rgba[index] = value;
					this._rgba[index] = coerceToRGBA(this._rgba)[index];
				}
			};
		}

		COMPONENT_KEYS[key] = true;
		COMPONENT_KEYS[alias] = true;
		descriptors[alias] = descriptors[key];
	}

	for (let i = 0, l = SWIZZLES.length; i < l; i++) {
		const [
			key,
			space,
			altSpace = "rgba",
			length
		] = SWIZZLES[i];

		if (space) {
			const toKey = `${altSpace.toUpperCase()}to${space.toUpperCase()}`,
				fromKey = `${space.toUpperCase()}to${altSpace.toUpperCase()}`;

			descriptors[key] = {
				get() {
					const converted = Color[toKey](this._rgba);
					return length ? converted.slice(0, length) : converted;
				},
				set(value) {
					if (this._checkImmutable() || !Array.isArray(value))
						return;

					this._rgba = coerceToRGBA(Color[fromKey](
						length ? value.slice(0, length) : value
					));
					this.space = key;
				}
			};
		} else {
			descriptors[key] = {
				get() {
					return length ?
						this._rgba.slice(0, length) :
						this._rgba.slice();
				},
				set(value) {
					if (this._checkImmutable() || !Array.isArray(value))
						return;

					this._rgba = coerceToRGBA(
						length ? value.slice(0, length) : value
					);
					this.space = key;
				}
			};
		}
	}

	Object.defineProperties(Color.prototype, descriptors);
})();

export {
	Gradient
};
