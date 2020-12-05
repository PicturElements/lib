const POLYFILL_PREFIXES = {
	symIterator: "@Polyfill:SymbolIterator",
	symbol: "@Polyfill:Symbol - "
};

const SYM_ITER_KEY = typeof Symbol == "undefined" ?
	POLYFILL_PREFIXES.symIterator :
	Symbol.iterator;

const BASE_62 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const BASE_64 = BASE_62 + "+/";
const BASE_64_YT = BASE_62 + "-_";

const CSS_PROPERTY_UNITS = {};

"animation-delay:s|animation-duration:s|background-position:%|background-position-x:%|background-position-y:%|baseline-shift:px|block-size:px|border-block-end-width:px|border-block-start-width:px|border-bottom-left-radius:px|border-bottom-right-radius:px|border-bottom-width:px|border-image-slice:%|border-inline-end-width:px|border-inline-start-width:px|border-left-width:px|border-radius:px|border-right-width:px|border-spacing:px|border-top-left-radius:px|border-top-right-radius:px|border-top-width:px|border-width:px|bottom:px|column-rule-width:px|font-size:px|font-stretch:%|height:px|inline-size:px|left:px|letter-spacing:px|margin:px|margin-block-end:px|margin-block-start:px|margin-bottom:px|margin-inline-end:px|margin-inline-start:px|margin-left:px|margin-right:px|margin-top:px|max-height:px|max-width:px|max-inline-size:px|min-height:px|min-width:px|min-inline-size:px|object-position:%|offset-distance:px|outline-offset:px|outline-width:px|padding:px|padding-block-end:px|padding-block-start:px|padding-bottom:px|padding-inline-end:px|padding-inline-start:px|padding-left:px|padding-right:px|padding-top:px|right:px|shape-margin:px|text-indent:px|top:px|transform-origin:px|transition-delay:s|transition-duration:s|width:px"
	.split("|")
	.forEach(v => {
		const [property, unit] = v.split(":");
		CSS_PROPERTY_UNITS[property] = unit;
	});

export {
	POLYFILL_PREFIXES,
	SYM_ITER_KEY,
	BASE_62,
	BASE_64,
	BASE_64_YT,
	CSS_PROPERTY_UNITS
};
