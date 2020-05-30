export default function parseSurrogatePair(source, offset = 0) {
	if (typeof source != "string" || offset < 0 || offset >= source.length) {
		return {
			character: "",
			length: 0,
			type: "none"
		};
	}

	const cc = source.charCodeAt(offset);
	if (cc >= 0xd800 && cc <= 0xdbff && offset < source.length - 1) {
		return {
			character: source[offset] + source[offset + 1],
			length: 2,
			type: "surrogate"
		};
	}

	return {
		character: source[offset],
		length: 1,
		type: "raw"
	};
}
