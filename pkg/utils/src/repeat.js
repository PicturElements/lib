export default function repeat(str, count = 0) {
	str = String(str);
	count = Number(count) || 0;

	if (count < 0)
		throw new RangeError("Invalid count value");

	if (!count || !str)
		return "";

	let out = "";

	// Pretty much completely ripped off the left-pad implementation
	// https://github.com/left-pad/left-pad/blob/master/index.js
	// because it's pretty elegant
	while (true) {
		if (count & 1)
			out += str;

		count >>= 1;

		if (count)
			str += str;
		else
			return out;
	}
}
