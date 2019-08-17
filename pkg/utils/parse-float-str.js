const floatStrRegex = /^(?:0[box])?[\d.e-]+f$/;

export default function parseFloatStr(str) {
	if (typeof str == "number")
		return str;

	if (typeof str != "string" || !floatStrRegex.test(str))
		return NaN;

	return Number(str.substr(0, str.length - 1));
}
