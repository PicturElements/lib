import {
	log2,
	log10
} from "./math";
import { coerceNum } from "./coerce";

function fitNum(num, min, max) {
	num = coerceNum(num, coerceNum(min, max));
	return Math.max(Math.min(num, max), min);
}

function isFiniteNum(num) {
	return typeof num == "number" && !isNaN(num) && isFinite(num);
}

function round(num, precision = 0) {
	num = Number(num);
	const div = Math.pow(10, precision);
	return Math.round(num * div) / div || 0;
}

function roundCustom(num, reference) {
	num = Number(num);
	return Math.round(num / reference) * reference || 0;
}

function roundToLen(num, length) {
	const sign = num < 0 ? "-" : "";
	length = typeof length == "number" ? length : 4;
	num = Math.abs(num);

	const numInt = "" + Math.floor(num),
		nil = numInt.length,
		numMask = Math.min(Math.pow(10, length - nil), 1e20),
		numDec = Math.round((1 + (Math.abs(num) % 1)) * numMask);

	if (nil >= length || numDec % numMask == 0)
		return sign + Math.round(num);

	return sign + numInt + "." + ("" + numDec).substring(1);
}

function numLen(num) {
	// If number is 0 or NaN, assume same-length number 1 (because log(0) == Infinity)
	num = Math.floor(Math.abs(Number(num) || 1));
	return Math.ceil(log10(num + 1));
}

// Flexible 
// Explanation of weights and limits:
// Iteration:	Maximum number of iterations to run continued fraction calculations
//				By default, this is set to 25 iterations. At 25, the slowest-approximating
//				continued fraction, that of phi, has reached an error of less than 1e-10
// Precision:	Maximum power of any one coefficient, used to control the precision of the
//				final fraction. This is because higher coefficients contribute a smaller
//				correction factor than lower ones
//				By default, this is set to 6, a power which for all intents and purposes would
//				contribute a minuscule amount to any continued fraction
// Variance:	Same as precision, but relative to the previous coefficient
function getFraction(num, options = {}) {
	const coefficients = [],
		iterations = typeof options.iterations == "number" ?
			options.iterations :
			25,
		precision = typeof options.precision == "number" ?
			Math.pow(10, options.precision) :
			1e6,
		variance = typeof options.variance == "number" ?
			Math.pow(10, options.variance) :
			1e6,
		sign = num < 0 ? -1 : 1;
	let n = Math.abs(num),
		numerator = 1,
		denominator = 1,
		flip = true;

	for (let i = 0; i < iterations; i++) {
		coefficients.push(Math.floor(n));
		n %= 1;

		if (!n)
			break;

		n = 1 / n;
		
		if (n > precision)
			break;

		if (i && n / coefficients[coefficients.length - 1] > variance)
			break;
	}

	denominator = coefficients[coefficients.length - 1];

	for (let i = coefficients.length - 2; i >= 0; i--) {
		const tmpDenominator = denominator;
		denominator = coefficients[i] * denominator + numerator;
		numerator = tmpDenominator;
	}

	return flip ?
		[sign * denominator, numerator] :
		[sign * numerator, denominator];
}

// Warning: max 32 bit signed int
function isPowerOf2(int) {
	return (int & (int - 1)) == 0;
}

function isPowerOf2i64(int) {
	return log2(int) % 1 == 0;
}

export {
	fitNum,
	isFiniteNum,
	round,
	roundCustom,
	roundToLen,
	numLen,
	getFraction,
	isPowerOf2,
	isPowerOf2i64
};
