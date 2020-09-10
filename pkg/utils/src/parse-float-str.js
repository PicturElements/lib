const FLOAT_STR_REGEX = /^(?:0[box])?[\d.e-]+f$/;

export default function parseFloatStr(str) {
	if (typeof str == "number")
		return str;

	if (typeof str != "string" || !FLOAT_STR_REGEX.test(str))
		return NaN;

	return Number(str.substring(0, str.length - 1));
}
