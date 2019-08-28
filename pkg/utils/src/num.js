function round(val, accuracy = 2) {
	val = Number(val);
	const div = Math.pow(10, accuracy);
	return Math.round(val * div) / div || 0;
}

function roundCustom(val, reference) {
	val = Number(val);
	return Math.round(val / reference) * reference || 0;
}

function numLen(num) {
	// If number is 0 or NaN, assume same-length number 1 (because log(0) == Infinity)
	num = Math.floor(Math.abs(Number(num) || 1));
	return Math.ceil(log10(num + 1));
}

const log2 = Math.log2 ? Math.log2 : num => Math.log(num) * Math.LOG2E;
const log10 = Math.log10 ? Math.log10 : num => Math.log(num) * Math.LOG10E;

// Warning: max 32 bit signed int
function isPowerOf2(int) {
	return (int & (int - 1)) == 0;
}

function isPowerOf2i64(int) {
	return (int && log2(int)) % 1 == 0;
}

export {
	round,
	roundCustom,
	numLen,
	log2,
	log10,
	isPowerOf2,
	isPowerOf2i64
};
