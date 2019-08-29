const colorClassifier = /^(?:#|rgba?|hsla?|cmyk)/,
	hexRegex = /^#([\da-f]{3,8})$/i,
	rgbRegex = /^rgba?\(\s*([\de.+-]+(%?)\s*(,?)\s*(?:[\de.+-]+\2\s*\3\s*){1,2}?(?:\s*(\/)?\s*[\de.+-]+(%?))?)\s*\)$/,
	hslRegex = /^hsla?\(\s*([\de.+-]+(?:deg|g?rad|turn)?\s*(,?)\s*(?:[\de.+-]+%\s*\2\s*){1,2}?(?:\s*(\/)?\s*[\de.+-]+(%?))?)\s*\)$/,
	cmykRegex = /^cmyk\(\s*([\de.+-]+%\s*(,?)\s*(?:[\de.+-]+%\s*\2\s*){2}(?:[\de.+-]+%\s*))\)$/;

const COL_NAMES = { black: "#000", silver: "#c0c0c0", gray: "#808080", white: "#fff", maroon: "#800000", red: "#f00", purple: "#800080", fuchsia: "#f0f", green: "#008000", lime: "#0f0", olive: "#808000", yellow: "#ff0", navy: "#000080", blue: "#00f", teal: "#008080", aqua: "#0ff", orange: "#ffa500", aliceblue: "#f0f8ff", antiquewhite: "#faebd7", aquamarine: "#7fffd4", azure: "#f0ffff", beige: "#f5f5dc", bisque: "#ffe4c4", blanchedalmond: "#ffebcd", blueviolet: "#8a2be2", brown: "#a52a2a", burlywood: "#deb887", cadetblue: "#5f9ea0", chartreuse: "#7fff00", chocolate: "#d2691e", coral: "#ff7f50", cornflowerblue: "#6495ed", cornsilk: "#fff8dc", crimson: "#dc143c", cyan: "#0ff", darkblue: "#00008b", darkcyan: "#008b8b", darkgoldenrod: "#b8860b", darkgray: "#a9a9a9", darkgreen: "#006400", darkgrey: "#a9a9a9", darkkhaki: "#bdb76b", darkmagenta: "#8b008b", darkolivegreen: "#556b2f", darkorange: "#ff8c00", darkorchid: "#9932cc", darkred: "#8b0000", darksalmon: "#e9967a", darkseagreen: "#8fbc8f", darkslateblue: "#483d8b", darkslategray: "#2f4f4f", darkslategrey: "#2f4f4f", darkturquoise: "#00ced1", darkviolet: "#9400d3", deeppink: "#ff1493", deepskyblue: "#00bfff", dimgray: "#696969", dimgrey: "#696969", dodgerblue: "#1e90ff", firebrick: "#b22222", floralwhite: "#fffaf0", forestgreen: "#228b22", gainsboro: "#dcdcdc", ghostwhite: "#f8f8ff", gold: "#ffd700", goldenrod: "#daa520", greenyellow: "#adff2f", grey: "#808080", honeydew: "#f0fff0", hotpink: "#ff69b4", indianred: "#cd5c5c", indigo: "#4b0082", ivory: "#fffff0", khaki: "#f0e68c", lavender: "#e6e6fa", lavenderblush: "#fff0f5", lawngreen: "#7cfc00", lemonchiffon: "#fffacd", lightblue: "#add8e6", lightcoral: "#f08080", lightcyan: "#e0ffff", lightgoldenrodyellow: "#fafad2", lightgray: "#d3d3d3", lightgreen: "#90ee90", lightgrey: "#d3d3d3", lightpink: "#ffb6c1", lightsalmon: "#ffa07a", lightseagreen: "#20b2aa", lightskyblue: "#87cefa", lightslategray: "#789", lightslategrey: "#789", lightsteelblue: "#b0c4de", lightyellow: "#ffffe0", limegreen: "#32cd32", linen: "#faf0e6", magenta: "#f0f", mediumaquamarine: "#66cdaa", mediumblue: "#0000cd", mediumorchid: "#ba55d3", mediumpurple: "#9370db", mediumseagreen: "#3cb371", mediumslateblue: "#7b68ee", mediumspringgreen: "#00fa9a", mediumturquoise: "#48d1cc", mediumvioletred: "#c71585", midnightblue: "#191970", mintcream: "#f5fffa", mistyrose: "#ffe4e1", moccasin: "#ffe4b5", navajowhite: "#ffdead", oldlace: "#fdf5e6", olivedrab: "#6b8e23", orangered: "#ff4500", orchid: "#da70d6", palegoldenrod: "#eee8aa", palegreen: "#98fb98", paleturquoise: "#afeeee", palevioletred: "#db7093", papayawhip: "#ffefd5", peachpuff: "#ffdab9", peru: "#cd853f", pink: "#ffc0cb", plum: "#dda0dd", powderblue: "#b0e0e6", rosybrown: "#bc8f8f", royalblue: "#4169e1", saddlebrown: "#8b4513", salmon: "#fa8072", sandybrown: "#f4a460", seagreen: "#2e8b57", seashell: "#fff5ee", sienna: "#a0522d", skyblue: "#87ceeb", slateblue: "#6a5acd", slategray: "#708090", slategrey: "#708090", snow: "#fffafa", springgreen: "#00ff7f", steelblue: "#4682b4", tan: "#d2b48c", thistle: "#d8bfd8", tomato: "#ff6347", turquoise: "#40e0d0", violet: "#ee82ee", wheat: "#f5deb3", whitesmoke: "#f5f5f5", yellowgreen: "#9acd32", rebeccapurple: "#639", transparent: "rgba(0,0,0,0)" },
	DEF_COL_DATA = {
		rgba: [0, 0, 0, 0],
		source: null,
		space: null
	},
	DEF_COL_MASK = [0, 0, 0, 1];

export default class Color {
	constructor(src, space) {
		this.rgba = [0, 0, 0, 0];
		this.source = null;
		this.space = null;

		if (src instanceof Color)
			this.setData(src, space);
		else if (src != null) {
			const parsed = Color.parseRaw(src);
			return this.setData(parsed, space);
		}
	}

	clone() {
		return new Color(this);
	}

	reset() {
		this.setData(DEF_COL_DATA);
		return this;
	}

	setData(ref, space) {
		this.source = ref.source;
		this.space = space || ref.space;
		this.rgba = ref.rgba && ref.rgba.slice();
		return this;
	}

	toString(space = this.space) {
		return Color.stringify(this.rgba, space);
	}

	// toString alias
	str(space) {
		return this.toString(space);
	}

	// %%%%%%%%%% IMMUTABLE TRANSFORM METHODS %%%%%%%%%%
	rotate(value, unit) {
		const rotation = parseRotation(value, unit),
			hsla = Color.RGBAtoHSLA(this.rgba);

		hsla[0] = (hsla[0] + rotation) % 360;
		
		return new Color(Color.HSLAtoRGBA(hsla), this.space);
	}


	// %%%%%%%%%% STATIC HELPERS %%%%%%%%%%
	static stringify(rgbaOrColor, type) {
		const c = (rgbaOrColor instanceof Color) ? rgbaOrColor.rgba : coerceToRGBA(rgbaOrColor);

		if (type == "auto")
			type = c[3] == 1 ? "rgb" : "rgba";

		switch (type) {
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
			case "rgba":
			/* fall through */
			default:
				return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${c[3]})`;
		}
	}

	static interpolate(pos, gradient) {
		if (!(gradient instanceof Gradient))
			return;

		pos = Math.max(Math.min(pos, 1), 0);
		return gradient.interpolate();
	}

	static interpolateCustom(pos, ...stops) {
		const gradient = this.buildGradient(stops);
		return this.interpolate(pos, gradient);
	}

	// Allowed stop formats:
	// "<col-string>", ...
	// ["<col-string>", <position, 0-1>], ...
	// "<col-string> <pos, 0-100>%, ..."
	// or any combination of the above (not recommended)
	static gradient(...stops) {
		return this.buildGradient(stops);
	}

	static buildGradient(stops) {
		if (stops.length == 1 && stops[0] instanceof Gradient)
			return stops[0];

		const gradient = new Gradient();

		for (let i = 0, l = stops.length; i < l; i++) {
			const stopData = parseGradientStop(stops[i]);

			if (Array.isArray(stopData))
				gradient.splice(gradient.length, 0, ...stopData);
			else if (stopData)
				gradient.push(stopData);
		}

		gradient.normalizeStopPositions();

		return gradient;
	}

	static storeGradient(name, ...stops) {
		if (!name || typeof name != "string")
			return warn(`Couldn't create gradient because '${name}' isn't a valid name`);

		const gradient = this.buildGradient(stops);
		this.gradients[name] = gradient;
		return gradient;
	}

	static resolveGradient(gradient) {
		if (gradient instanceof Gradient)
			return gradient;

		return this.gradients[gradient] || Gradient.cache[gradient] || Gradient.NULL;
	}

	// %%%%%%%%%% COLOR PARSING %%%%%%%%%%
	static parse(src) {
		if (src instanceof Color)
			return src;

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

			if (!src)
				return DEF_COL_DATA;

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

		if (COL_NAMES.hasOwnProperty(src))
			src = COL_NAMES[src];

		if (Color.cache[src])
			return Color.cache[src];

		const cls = colorClassifier.exec(src);

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
	static parseHex(str) {
		const ex = hexRegex.exec(str),
			matchLen = ex && ex[1].length;

		if (!ex || (matchLen > 3 && matchLen % 2))	// 3 character hex is valid, 5 and 7 are not
			return warn(`Could not parse string '${str}' because it's not a valid hex value`);

		const hex = ex[1],
			rgba = [0, 0, 0, 255],
			isShorthand = matchLen < 6,
			tokenLen = isShorthand ? hex.length : hex.length / 2;

		for (let i = 0; i < tokenLen; i++) {
			if (isShorthand)
				rgba[i] = hexToDecimal(hex[i]) * 17;
			else
				rgba[i] = hexToDecimal(hex.substr(i * 2, 2));
		}

		rgba[3] /= 255;
		return coerceToRGBA(rgba);
	}

	// ========== RGB(A) ==========
	static parseRGB(str) {
		const rgb = parseRGBHelper(str);

		if (!rgb)
			return warn(`Could not parse color string '${str}' because it's not a valid RGB value`);

		return rgb;
	}

	static parseRGBA(str) {
		const rgba = parseRGBHelper(str);

		if (!rgba)
			return warn(`Could not parse color string '${str}' because it's not a valid RGBA value`);

		return rgba;
	}

	// ========== HSL ==========
	static parseHSL(str) {
		const hsl = parseHSLHelper(str);

		if (!hsl)
			return warn(`Could not parse color string '${str}' because it's not a valid HSL value`);

		return hsl.length == 3 ? this.HSLtoRGB(hsl) : this.HSLAtoRGBA(hsl);
	}

	static parseHSLA(str) {
		const hsla = parseHSLHelper(str);

		if (!hsla)
			return warn(`Could not parse color string '${str}' because it's not a valid HSLA value`);

		return hsla.length == 3 ? this.HSLtoRGB(hsla) : this.HSLAtoRGBA(hsla);
	}

	// ========== CMYK ==========
	static parseCMYK(str) {
		const cmyk = parseCMYKHelper(str);

		if (!cmyk)
			return warn(`Could not parse color string '${str}' because it's not a valid CMYK value`);

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
			const q = l < 0.5 ? l * (1 + s) : l + s - l * s,
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
		rgba[3] = hsla[3];
		return rgba;
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

		s = l > 0.5 ? d / (2 - mm) : d / mm;

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

		return [h * 360, s * 100, l * 100];
	}

	static RGBAtoHSLA(rgba) {
		rgba = coerceParse(rgba);
		const hsla = this.RGBtoHSL(rgba);
		hsla[3] = rgba[3];
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
}

Color.suppressWarnings = false;
Color.supportedColorSpaces = ["hex", "rgb", "hsl", "cmyk"];
Color.cache = Object.create(null);
Color.gradients = Object.create(null);
Color.NULL = new Color("black");

class Gradient extends Array {
	constructor(arr) {
		if (Array.isArray(arr))
			super(...arr);
		else
			super();
	}

	normalizeStopPositions() {
		if (!this.length)
			return;

		if (!isNum(this[0].position))
			this[0].position = 0;

		if (!isNum(this[this.length - 1].position))
			this[this.length - 1].position = 1;

		const len = this.length;
		let backlog = 0,
			prevPosition = 0;

		for (let i = 0; i < len; i++) {
			const item = this[i],
				position = item.position;

			if (!isNum(position)) {
				backlog++;
				continue;
			}

			if (backlog) {
				const step = (position - prevPosition) / (backlog + 1);
				while (backlog)
					this[i - backlog].position = position - (backlog--) * step;
			}

			prevPosition = position;
		}

		this.sort((a, b) => compare(a.position, b.position));
	}

	interpolate(pos = 0, type = "rgba") {
		if (!this.length)
			return Color.stringify(Color.defaults.transparents, type);

		let start = 0,
			end = this.length - 1,
			pivot,
			pivotPos,
			basis;

		while (true) {
			if (end - start < 2) {
				basis = start;

				if (this[start].position > pos)
					basis = start - 1;
				else if (this[end].position < pos)
					basis = end;

				break;
			}

			pivot = Math.floor((start + end) / 2);
			pivotPos = this[pivot].position;

			if (pivotPos > pos)
				end = pivot;
			else
				start = pivot;
		}

		const from = this[Math.max(basis, 0)],
			to = this[Math.min(basis + 1, this.length - 1)],
			at = (to.position - pos) / (to.position - from.position || to.position);

		return Gradient.doInterpolation(from.color, to.color, at, type);
	}

	static doInterpolation(from, to, at, runtime, type = "auto") {
		const toRGBA = to.rgba,
			rgba = from.rgba.map((c, i) => (c * at) + (toRGBA[i] * (1 - at)));

		return Color.stringify(rgba, type);
	}
}

Gradient.cache = Object.create(null);
Gradient.NULL = new Gradient();

const gradientStopRegex = /(#\w{3,8}|(?:rgba?|hsla?)\(.*?\))|([\de.+-]+)%|,/g;

function parseGradientStop(stopFmt) {
	gradientStopRegex.lastIndex = 0;

	let currentStop = null,
		lastStop = null,
		stopArr = null;

	if (stopFmt instanceof Gradient)
		return stopFmt;

	if (Array.isArray(stopFmt)) {
		return {
			color: Color.parse(stopFmt[0]),
			position: stopFmt[1]
		};
	}

	if (typeof stopFmt != "string")
		return null;

	if (Color.gradients[stopFmt])
		return Color.gradients[stopFmt];
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
				color: Color.parse(ex[1]),
				position: null
			};

			lastStop = currentStop;
			if (stopArr)
				stopArr.push(currentStop);
		} else if (ex[2]) {
			if (!currentStop)
				return warn(`Malformed gradient '${stopFmt}' (position before color)`);
			if (currentStop.position != null)
				return warn(`Malformed gradient '${stopFmt}' (position already specified)`);

			currentStop.position = Number(ex[2]) / 100;
		} else if (ex[0] == ",")
			currentStop = null;
	}

	if (stopArr)
		Gradient.cache[stopFmt] = new Gradient(stopArr);
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

function parseRGBHelper(str) {
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
function parseHSLHelper(str) {
	const ex = hslRegex.exec(str);

	if (!ex)
		return null;

	if (ex[2] && ex[3])		// comma format and whitespace alpha separator are incompatible
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

function coerceParse(arrOrStr) {
	if (Array.isArray(arrOrStr))
		return arrOrStr;

	const parsed = Color.parseRaw(arrOrStr);
	if (!parsed || !parsed.rgba)
		return DEF_COL_DATA;

	return parsed.rgba;
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
function coerceToRGBA(rgba) {
	if (!Array.isArray(rgba))
		return warn(`${rgba} is not an RGB(A) array`);

	if (rgba.length < 3 || rgba.length > 4)
		return warn(`Invalid RGB(A) length for format [${rgba}]: format must contain 3-4 components`);

	if (rgba.length == 3)
		rgba.push(1);

	for (let i = 0; i < 3; i++)
		rgba[i] = roundCap(rgba[i], 0, 255);
	rgba[3] = roundCap(rgba[3], 0, 1, 2);

	if (rgba.some(isNaN))
		return warn("Invalid RGB(A) format: invalid components");

	return rgba;
}

// HSLA format: [360, 100, 100, 1]
function coerceToHSLA(hsla) {
	if (!Array.isArray(hsla))
		return warn(`${hsla} is not an HSL(A) array`);

	if (hsla.length < 3 || hsla.length > 4)
		return warn(`Invalid HSL(A) length for format [${hsla}]: format must contain 3-4 components`);

	if (hsla.length == 3)
		hsla.push(1);

	hsla[0] = roundCap(hsla[0], 0, 360);
	hsla[1] = roundCap(hsla[1], 0, 100);
	hsla[2] = roundCap(hsla[2], 0, 100);
	hsla[3] = roundCap(hsla[3], 0, 1, 2);

	if (hsla.some(isNaN))
		return warn("Invalid HSL(A) format: invalid components");

	return hsla;
}

// CMYK format: [100, 100, 100, 100]
function coerceToCMYK(cmyk) {
	if (!Array.isArray(cmyk))
		return warn(`${cmyk} is not an CMYK array`);

	if (cmyk.length != 4)
		return warn(`Invalid CMYK length for format [${cmyk}]: format must contain 4 components`);

	for (let i = 0; i < 4; i++)
		cmyk[i] = roundCap(cmyk[i], 0, 100);

	if (cmyk.some(isNaN))
		return warn("Invalid CMYK format: invalid components");

	return cmyk;
}

function cap(n, min, max) {
	n = Number(n);
	return Math.max(Math.min(n, max), min);
}

function roundCap(n, min, max, accuracy) {
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

export {
	Gradient
};
