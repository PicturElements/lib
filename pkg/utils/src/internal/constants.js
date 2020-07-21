import lookup from "../lookup";

const POLYFILL_PREFIXES = {
	symIterator: "@Polyfill:SymbolIterator",
	symbol: "@Polyfill:Symbol - "
};

const SYM_ITER_KEY = typeof Symbol == "undefined" ?
	POLYFILL_PREFIXES.symIterator :
	Symbol.iterator;

// Whitespace characters (as recognized by the standard of String.prototype.trim)
const WHITESPACE = lookup("\t\n\v\f\r \xa0\u2028\u2029\ufeff", "");
const VOID_TAGS = lookup("area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr");
const BOOLEAN_ATTRS = lookup("allowfullscreen|allowpaymentrequest|async|autofocus|autoplay|checked|controls|default|disabled|formnovalidate|hidden|ismap|itemscope|loop|multiple|muted|nomodule|novalidate|open|playsinline|readonly|required|reversed|selected|truespeed");

const DOM_NAMESPACES = [
	{
		uri: "http://www.w3.org/2000/svg",
		tagGetter: t => t,
		tags: lookup("altGlyph|altGlyphDef|altGlyphItem|animate|animateColor|animateMotion|animateTransform|circle|clipPath|color-profile|cursor|defs|desc|discard|ellipse|feBlend|feColorMatrix|feComponentTransfer|feComposite|feConvolveMatrix|feDiffuseLighting|feDisplacementMap|feDistantLight|feDropShadow|feFlood|feFuncA|feFuncB|feFuncG|feFuncR|feGaussianBlur|feImage|feMerge|feMergeNode|feMorphology|feOffset|fePointLight|feSpecularLighting|feSpotLight|feTile|feTurbulence|filter|font-face|font-face-format|font-face-name|font-face-src|font-face-uri|foreignObject|g|glyph|glyphRef|hatch|hatchpath|hkern|image|line|linearGradient|marker|mask|mesh|meshgradient|meshpatch|meshrow|metadata|missing-glyph|mpath|path|pattern|polygon|polyline|radialGradient|rect|set|solidcolor|stop|svg|switch|symbol|text|textPath|tref|tspan|unknown|use|view|vkern")
	},
	{
		uri: "http://www.w3.org/2000/svg",
		tagGetter: t => t.replace(/^svg:/, ""),
		tags: lookup("svg:a|svg:font|svg:script|svg:style|svg:title")
	}
];

const BASE_62 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const BASE_64 = BASE_62 + "+/";
const BASE_64_YT = BASE_62 + "-_";

export {
	POLYFILL_PREFIXES,
	SYM_ITER_KEY,
	WHITESPACE,
	VOID_TAGS,
	BOOLEAN_ATTRS,
	DOM_NAMESPACES,
	BASE_62,
	BASE_64,
	BASE_64_YT
};
