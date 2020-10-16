import lookup from "../lookup";

// Whitespace characters (as recognized by the standard of String.prototype.trim)
const WHITESPACES = lookup("\t\n\v\f\r \xa0\u2028\u2029\ufeff", "");
const VOID_TAGS = lookup("area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr");
const BOOLEAN_ATTRS = lookup("allowfullscreen|allowpaymentrequest|async|autofocus|autoplay|checked|controls|default|disabled|formnovalidate|hidden|ismap|itemscope|loop|multiple|muted|nomodule|novalidate|open|playsinline|readonly|required|reversed|selected|truespeed");
// https://mathiasbynens.be/notes/javascript-identifiers
const KEYWORDS = lookup("break|case|catch|continue|debugger|default|delete|do|else|finally|for|function|if|in|instanceof|new|return|switch|this|throw|try|typeof|var|void|while|with");
const RESERVED_WORDS = lookup("class|const|enum|export|extends|import|super|implements|interface|let|package|private|protected|public|static|yield");
const BAD_IDENTIFIERS = lookup("undefined|null|true|false|NaN|Infinity");

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

export {
	WHITESPACES,
	VOID_TAGS,
	BOOLEAN_ATTRS,
	DOM_NAMESPACES,
	KEYWORDS,
	RESERVED_WORDS,
	BAD_IDENTIFIERS
};
