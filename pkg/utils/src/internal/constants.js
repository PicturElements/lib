import lookup from "../lookup";

const POLYFILL_PREFIXES = {
	symIterator: "@Polyfill:SymbolIterator",
	symbol: "@Polyfill:Symbol - "
};

const SYM_ITER_KEY = typeof Symbol == "undefined" ?
	POLYFILL_PREFIXES.symIterator :
	Symbol.iterator;

const VOID_TAGS = lookup("area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr");

const DOM_NAMESPACES = [
	{
		uri: "http://www.w3.org/2000/svg",
		tagGetter(t) { return t; },
		tags: lookup("altGlyph|altGlyphDef|altGlyphItem|animate|animateColor|animateMotion|animateTransform|circle|clipPath|color-profile|cursor|defs|desc|discard|ellipse|feBlend|feColorMatrix|feComponentTransfer|feComposite|feConvolveMatrix|feDiffuseLighting|feDisplacementMap|feDistantLight|feDropShadow|feFlood|feFuncA|feFuncB|feFuncG|feFuncR|feGaussianBlur|feImage|feMerge|feMergeNode|feMorphology|feOffset|fePointLight|feSpecularLighting|feSpotLight|feTile|feTurbulence|filter|font-face|font-face-format|font-face-name|font-face-src|font-face-uri|foreignObject|g|glyph|glyphRef|hatch|hatchpath|hkern|image|line|linearGradient|marker|mask|mesh|meshgradient|meshpatch|meshrow|metadata|missing-glyph|mpath|path|pattern|polygon|polyline|radialGradient|rect|set|solidcolor|stop|svg|switch|symbol|text|textPath|tref|tspan|unknown|use|view|vkern")
	},
	{
		uri: "http://www.w3.org/2000/svg",
		tagGetter(t) { return t.replace("svg:", ""); },
		tags: lookup("svg:a|svg:font|svg:script|svg:style|svg:title")
	}
];

export {
	POLYFILL_PREFIXES,
	SYM_ITER_KEY,
	VOID_TAGS,
	DOM_NAMESPACES
};
