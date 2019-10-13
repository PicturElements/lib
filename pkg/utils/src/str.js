function cleanRegex(str) {
	return str.replace(/[$^()\]\/\\]/g, "\\$&");
}

function cleanPath(str) {
	return escape(str).replace(/(\])/g, "\\$&");
}

function escape(str) {
	return str.replace(/['"`\\]/g, match => `\\${match}`);
}

function unescape(str) {
	return String(str).replace(/\\(.)/g, "$1");
}

function repeat(str, count = 0) {
	str = String(str);
	count = Number(count) || 0;

	if (count < 0)
		throw new RangeError("Invalid count value");

	if (!count)
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

function padStart(str, length = 2, padChar = " ") {
	str = String(str);
	const pad = length - str.length;

	if (pad > 0)
		return repeat(padChar, pad) + str;

	return str;
}

function padEnd(str, length = 2, padChar = " ") {
	str = String(str);
	const pad = length - str.length;

	if (pad > 0)
		return str + repeat(padChar, pad);

	return str;
}

export {
	cleanRegex,
	cleanPath,
	escape,
	unescape,
	repeat,
	padStart,
	padEnd
};
